import { randomUUID } from 'node:crypto'
import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { users, sessions } from '../database/schema'
import { getClientIpAddress } from './ip'
import { signAccessToken, signRefreshToken, setAuthCookies, REFRESH_TTL_SECONDS } from './jwt'

type UserRow = typeof users.$inferSelect

function deviceLabelFromUA(ua?: string): string {
  if (!ua) return 'Unknown device'
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  return `${browser} on ${os}`
}

const listOf = (v?: string) => (v ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)

/**
 * Admins named in the environment: ADMIN_EMAILS (Google) and ADMIN_TELEGRAM_IDS (numeric Telegram
 * ids), comma-separated. Such an account becomes an admin when it signs in; nobody is demoted.
 */
async function promoteIfListed(row: UserRow): Promise<UserRow> {
  if (row.role === 'admin') return row
  const listed = (row.email && listOf(process.env.ADMIN_EMAILS).includes(row.email.toLowerCase()))
    || (row.telegramId && listOf(process.env.ADMIN_TELEGRAM_IDS).includes(row.telegramId))
  if (!listed) return row
  const [updated] = await useDb().update(users).set({ role: 'admin', updatedAt: new Date() }).where(eq(users.id, row.id)).returning()
  return updated ?? row
}

/** Starts a session for `row` on this device and sets the auth cookies. Returns the user as signed in. */
export async function signIn(event: H3Event, row: UserRow): Promise<UserRow> {
  return (await startSession(event, row)).user
}

/** As signIn, with the device session's id too (a mock seat ends that one session when it is given up). */
export async function startSession(event: H3Event, row: UserRow): Promise<{ user: UserRow, sessionId: string }> {
  row = await promoteIfListed(row)
  const ua = getRequestHeader(event, 'user-agent')
  const [session] = await useDb().insert(sessions).values({
    userId: row.id,
    userAgent: ua ?? null,
    deviceLabel: deviceLabelFromUA(ua),
    ipAddress: getClientIpAddress(event),
    expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000)
  }).returning()

  const access = await signAccessToken(row.id, row.role, randomUUID())
  const refresh = await signRefreshToken(row.id, session!.id)
  setAuthCookies(event, access, refresh)
  return { user: row, sessionId: session!.id }
}

/** Where to go after signing in: the page it started from (only a path on this site), via onboarding the first time. */
export function afterSignIn(event: H3Event, row: UserRow): string {
  const next = getCookie(event, 'ml_next')
  deleteCookie(event, 'ml_next', { path: '/' })
  const back = next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/auth/') ? next : '/tests'
  return row.onboarded ? back : `/onboarding?next=${encodeURIComponent(back)}`
}

/** How a user is named where a name is missing: email, Telegram username, or a plain label. */
export const userLabel = (u: { name?: string | null, email?: string | null, telegramUsername?: string | null }) =>
  u.name || u.email || (u.telegramUsername ? `@${u.telegramUsername}` : 'Telegram user')
