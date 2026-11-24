import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { googleConnections } from '../database/schema'

/**
 * Google Calendar for a teacher's online classes: they connect their Google account once
 * (/auth/google-calendar, the calendar.events permission, offline), and each online class becomes
 * an event in their calendar with a Google Meet link, changed and cancelled with it. Needs the
 * Google Calendar API on in the Google Cloud project that holds the sign-in client, and
 * <site>/auth/google-calendar among its redirect addresses. The tokens are kept encrypted
 * (GOOGLE_TOKEN_KEY, else derived from NUXT_SESSION_PASSWORD).
 *
 * GOOGLE_API_BASE and GOOGLE_OAUTH_TOKEN_URL point it elsewhere (a stand-in for tests).
 */

export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const apiBase = () => (process.env.GOOGLE_API_BASE || 'https://www.googleapis.com').replace(/\/$/, '')
export const tokenUrl = () => process.env.GOOGLE_OAUTH_TOKEN_URL || 'https://oauth2.googleapis.com/token'
export const TIME_ZONE = 'Asia/Tashkent'

/** A request to Google: JSON back, or an error carrying Google's status and answer. */
async function google<T>(url: string, opts: { method?: string, query?: Record<string, string>, json?: unknown, form?: Record<string, string>, token?: string } = {}): Promise<T> {
  const u = new URL(url)
  for (const [k, v] of Object.entries(opts.query ?? {})) u.searchParams.set(k, v)
  const headers: Record<string, string> = {}
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`
  let body: string | undefined
  if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.json)
  } else if (opts.form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    body = new URLSearchParams(opts.form).toString()
  }
  const res = await fetch(u, { method: opts.method ?? 'GET', headers, body, signal: AbortSignal.timeout(15_000) })
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) throw Object.assign(new Error(`Google ${res.status}`), { statusCode: res.status, data })
  return data as T
}

// ---------- tokens, encrypted ----------

function key() {
  const secret = process.env.GOOGLE_TOKEN_KEY || process.env.NUXT_SESSION_PASSWORD || String(useRuntimeConfig().session?.password ?? '')
  if (!secret) throw createError({ statusCode: 500, message: 'No key to keep Google tokens with' })
  return createHash('sha256').update(`google-tokens:${secret}`).digest()
}
export function seal(plain: string) {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key(), iv)
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return [iv, c.getAuthTag(), data].map(b => b.toString('base64url')).join('.')
}
export function unseal(sealed: string) {
  const [iv, tag, data] = sealed.split('.').map(p => Buffer.from(p, 'base64url'))
  const d = createDecipheriv('aes-256-gcm', key(), iv!)
  d.setAuthTag(tag!)
  return Buffer.concat([d.update(data!), d.final()]).toString('utf8')
}

/** Saves what Google gave on connecting. Without a refresh token (connected before, no consent asked) the old one stays. */
export async function saveConnection(userId: string, tokens: { access_token?: string, refresh_token?: string, expires_in?: number, scope?: string }, googleEmail: string | null) {
  const db = useDb()
  const [had] = await db.select({ refreshToken: googleConnections.refreshToken }).from(googleConnections).where(eq(googleConnections.userId, userId)).limit(1)
  const refresh = tokens.refresh_token ? seal(tokens.refresh_token) : had?.refreshToken
  if (!refresh) throw createError({ statusCode: 400, message: 'Google did not give lasting access. Try connecting again.' })
  if (tokens.scope && !tokens.scope.split(' ').includes(CALENDAR_SCOPE)) throw createError({ statusCode: 400, message: 'Allow Mockmee to add events to your calendar to make Meet links.' })
  const values = {
    googleEmail,
    refreshToken: refresh,
    accessToken: tokens.access_token ? seal(tokens.access_token) : null,
    expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
    scope: tokens.scope ?? null
  }
  await db.insert(googleConnections).values({ userId, ...values })
    .onConflictDoUpdate({ target: googleConnections.userId, set: { ...values, updatedAt: new Date() } })
}

export async function connectionOf(userId: string) {
  const [row] = await useDb().select({ googleEmail: googleConnections.googleEmail, createdAt: googleConnections.createdAt })
    .from(googleConnections).where(eq(googleConnections.userId, userId)).limit(1)
  return row ?? null
}

/** Forgets the connection, and asks Google to take the access back (best effort). */
export async function disconnect(userId: string) {
  const db = useDb()
  const [row] = await db.select().from(googleConnections).where(eq(googleConnections.userId, userId)).limit(1)
  if (!row) return
  await db.delete(googleConnections).where(eq(googleConnections.userId, userId))
  try {
    await google('https://oauth2.googleapis.com/revoke', { method: 'POST', form: { token: unseal(row.refreshToken) } })
  } catch {}
}

const reconnect = () => createError({ statusCode: 409, message: 'Your Google connection has ended: connect Google again to make Meet links.', data: { code: 'GOOGLE_RECONNECT' } })

/** A working access token for the teacher, renewed when it is about to run out. */
async function accessTokenOf(userId: string) {
  const db = useDb()
  const [row] = await db.select().from(googleConnections).where(eq(googleConnections.userId, userId)).limit(1)
  if (!row) throw createError({ statusCode: 409, message: 'Connect your Google account to make Meet links.', data: { code: 'GOOGLE_NOT_CONNECTED' } })
  if (row.accessToken && row.expiresAt && row.expiresAt.getTime() > Date.now() + 60_000) return unseal(row.accessToken)
  const { clientId, clientSecret } = useRuntimeConfig().oauth?.google ?? {}
  if (!clientId || !clientSecret) throw createError({ statusCode: 503, message: 'Google sign-in is not set up here' })
  let res: { access_token: string, expires_in: number }
  try {
    res = await google(tokenUrl(), {
      method: 'POST',
      form: { grant_type: 'refresh_token', refresh_token: unseal(row.refreshToken), client_id: String(clientId), client_secret: String(clientSecret) }
    })
  } catch (e: any) {
    // The teacher took the access back, or it lapsed: connect again.
    if (e?.data?.error === 'invalid_grant') {
      await db.delete(googleConnections).where(eq(googleConnections.userId, userId))
      throw reconnect()
    }
    throw createError({ statusCode: 502, message: 'Google did not answer. Try again in a minute.' })
  }
  await db.update(googleConnections).set({ accessToken: seal(res.access_token), expiresAt: new Date(Date.now() + res.expires_in * 1000), updatedAt: new Date() })
    .where(eq(googleConnections.userId, userId))
  return res.access_token
}

async function calendar<T>(userId: string, path: string, opts: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE', query?: Record<string, string>, body?: unknown } = {}): Promise<T> {
  const token = await accessTokenOf(userId)
  try {
    return await google<T>(`${apiBase()}/calendar/v3${path}`, { method: opts.method ?? 'GET', query: opts.query, json: opts.body, token })
  } catch (e: any) {
    if (e?.statusCode === 401) throw reconnect()
    if (e?.statusCode === 403) throw createError({ statusCode: 409, message: 'Google refused: allow Mockmee to add events to your calendar, then try again.', data: { code: 'GOOGLE_RECONNECT' } })
    if (opts.method === 'DELETE' && (e?.statusCode === 404 || e?.statusCode === 410)) return undefined as T
    throw createError({ statusCode: 502, message: e?.data?.error?.message || 'Google Calendar did not answer. Try again in a minute.' })
  }
}

interface GoogleEvent {
  id: string
  htmlLink?: string
  hangoutLink?: string
  conferenceData?: { entryPoints?: { entryPointType: string, uri: string }[], createRequest?: { status?: { statusCode: string } } }
}
const meetOf = (e: GoogleEvent) => e.hangoutLink || e.conferenceData?.entryPoints?.find(p => p.entryPointType === 'video')?.uri || null

export interface MeetEventInput { title: string, description?: string | null, startsAt: Date, durationMinutes: number }
const times = (i: MeetEventInput) => ({
  start: { dateTime: i.startsAt.toISOString(), timeZone: TIME_ZONE },
  end: { dateTime: new Date(i.startsAt.getTime() + i.durationMinutes * 60_000).toISOString(), timeZone: TIME_ZONE }
})

/** A Calendar event in the teacher's calendar with a new Meet link. */
export async function createMeetEvent(userId: string, input: MeetEventInput) {
  let event = await calendar<GoogleEvent>(userId, '/calendars/primary/events', {
    method: 'POST',
    query: { conferenceDataVersion: '1' },
    body: {
      summary: input.title,
      description: input.description || 'An online class on Mockmee.',
      ...times(input),
      conferenceData: { createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } }
    }
  })
  // The link is usually there at once; while Google is still making it, ask again a few times.
  for (let i = 0; i < 4 && !meetOf(event) && event.conferenceData?.createRequest?.status?.statusCode === 'pending'; i++) {
    await new Promise(r => setTimeout(r, 1000))
    event = await calendar<GoogleEvent>(userId, `/calendars/primary/events/${encodeURIComponent(event.id)}`)
  }
  const meetUrl = meetOf(event)
  if (!meetUrl) throw createError({ statusCode: 502, message: 'Google made the event but no Meet link. Is Google Meet on for your account?' })
  return { eventId: event.id, meetUrl, htmlLink: event.htmlLink ?? null }
}

/** The event moved or renamed with its class. */
export async function updateMeetEvent(userId: string, eventId: string, input: MeetEventInput) {
  await calendar(userId, `/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    body: { summary: input.title, description: input.description || 'An online class on Mockmee.', ...times(input) }
  })
}

/** The event taken off the teacher's calendar (gone already is fine). */
export async function cancelMeetEvent(userId: string, eventId: string) {
  await calendar(userId, `/calendars/primary/events/${encodeURIComponent(eventId)}`, { method: 'DELETE' })
}
