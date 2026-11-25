import { and, desc, eq, gt, inArray, isNotNull, notInArray, sql } from 'drizzle-orm'
import { broadcasts, users } from '../database/schema'
import { asLocale, escapeHtml, type Locale } from './messages'
import { telegramApi, telegramBotToken } from './telegram'
import { postChannels } from './channels'

/**
 * Broadcasts: news and updates an admin sends through the bot to everyone it may write to (those who
 * connected Telegram, left notifications on and have not blocked it), or to students, teachers, one
 * exam's candidates or one language's readers; and, if picked, to the Telegram channels. Each user
 * gets the message in their language when it was written in it, else the first one written. Sent in
 * the background at about 25 messages a second; the admin page shows how far it has got.
 */

export const BROADCAST_ROLES = ['ALL', 'STUDENTS', 'TEACHERS'] as const
export interface Audience { role: (typeof BROADCAST_ROLES)[number], exam: 'ANY' | Exam, locale: 'ANY' | Locale }
export interface Draft { texts: Partial<Record<Locale, string>>, imageUrl: string | null, buttonText: string | null, buttonUrl: string | null }

const TEACHING: (typeof users.role.enumValues)[number][] = ['teacher', 'center_owner', 'admin']
const siteUrl = () => String(useRuntimeConfig().public.siteUrl || 'https://mockmee.uz').replace(/\/$/, '')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** The admin's text as Telegram HTML: escaped, then **bold**, _italic_ and [text](https://link). */
export function formatBroadcast(text: string) {
  return escapeHtml(text.trim())
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])_(.+?)_(?=[\s).,!?]|$)/gm, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label: string, url: string) => `<a href="${url.replace(/"/g, '&quot;')}">${label}</a>`)
}

export function broadcastAudience(body: any): Audience {
  const a = body && typeof body === 'object' ? body : {}
  return {
    role: BROADCAST_ROLES.includes(a.role) ? a.role : 'ALL',
    exam: isExam(a.exam) ? a.exam : 'ANY',
    locale: a.locale === 'uz' || a.locale === 'ru' || a.locale === 'en' ? a.locale : 'ANY'
  }
}

/** A message from a request: at least one language, short enough for Telegram, a safe button link. */
export function draftOf(body: any): Draft {
  const texts: Draft['texts'] = {}
  const imageUrl = /^https?:\/\/\S+$/i.test(String(body?.imageUrl ?? '').trim()) ? String(body.imageUrl).trim() : null
  const max = imageUrl ? 1000 : 3800
  for (const l of ['uz', 'ru', 'en'] as const) {
    const s = String(body?.texts?.[l] ?? '').trim()
    if (!s) continue
    if (s.length > max) throw createError({ statusCode: 400, message: `The ${l} text is too long (at most ${max} characters${imageUrl ? ' with a picture' : ''})` })
    texts[l] = s
  }
  if (!Object.keys(texts).length) throw createError({ statusCode: 400, message: 'Write the message in at least one language' })
  const buttonText = String(body?.buttonText ?? '').trim().slice(0, 40) || null
  const raw = String(body?.buttonUrl ?? '').trim()
  const buttonUrl = raw ? (raw.startsWith('/') ? `${siteUrl()}${raw}` : /^https?:\/\//i.test(raw) ? raw : null) : null
  if (raw && !buttonUrl) throw createError({ statusCode: 400, message: 'The button link starts with https:// or / (a page of the site)' })
  return { texts, imageUrl, buttonText: buttonText && buttonUrl ? buttonText : null, buttonUrl: buttonText && buttonUrl ? buttonUrl : null }
}

/** The text a reader gets: in their language if written, else the first written (uz, ru, en). */
const textFor = (d: Draft, l: Locale) => d.texts[l] ?? d.texts.uz ?? d.texts.ru ?? d.texts.en ?? ''

function reachable(a: Audience) {
  return and(
    isNotNull(users.telegramId), eq(users.telegramNotify, true), eq(users.telegramBotJoined, true), eq(users.banned, false),
    a.role === 'STUDENTS' ? notInArray(users.role, TEACHING) : a.role === 'TEACHERS' ? inArray(users.role, TEACHING) : undefined,
    a.exam !== 'ANY' ? eq(users.exam, a.exam) : undefined,
    a.locale !== 'ANY' ? eq(users.locale, a.locale) : undefined
  )
}

export async function countAudience(a: Audience) {
  const [row] = await useDb().select({ n: sql<number>`count(*)::int` }).from(users).where(reachable(a))
  return row?.n ?? 0
}

/** One message to one chat (a user or a channel). */
async function deliver(chat: string, d: Draft, l: Locale) {
  const text = formatBroadcast(textFor(d, l))
  const reply_markup = d.buttonText && d.buttonUrl ? { inline_keyboard: [[{ text: d.buttonText, url: d.buttonUrl }]] } : undefined
  return d.imageUrl
    ? telegramApi('sendPhoto', { chat_id: chat, photo: d.imageUrl, caption: text, parse_mode: 'HTML', ...(reply_markup ? { reply_markup } : {}) })
    : telegramApi('sendMessage', { chat_id: chat, text, parse_mode: 'HTML', link_preview_options: { is_disabled: !!reply_markup }, ...(reply_markup ? { reply_markup } : {}) })
}

/** The draft sent to the admin alone, to see it as everyone will. */
export async function sendTestBroadcast(adminId: string, d: Draft) {
  if (!telegramBotToken()) throw createError({ statusCode: 503, message: 'The Telegram bot is not set up on this site' })
  const [me] = await useDb().select({ chat: users.telegramId, locale: users.locale }).from(users).where(eq(users.id, adminId)).limit(1)
  if (!me?.chat) throw createError({ statusCode: 400, message: 'Connect your own Telegram (Settings) to get a test message' })
  const res = await deliver(me.chat, d, asLocale(me.locale)).catch((e: any) => ({ ok: false, description: e?.message }))
  if (!res.ok) throw createError({ statusCode: 502, message: `Telegram refused it: ${res.description ?? 'unknown error'}` })
  return { ok: true }
}

/** Sends a saved broadcast in the background: to its channels, then to every reader, page by page. */
export async function runBroadcast(id: string) {
  const db = useDb()
  const [b] = await db.select().from(broadcasts).where(eq(broadcasts.id, id)).limit(1)
  if (!b) return
  const d: Draft = { texts: b.texts as Draft['texts'], imageUrl: b.imageUrl, buttonText: b.buttonText, buttonUrl: b.buttonUrl }
  let sent = 0
  let failed = 0
  const save = () => db.update(broadcasts).set({ sent, failed }).where(eq(broadcasts.id, id))
  try {
    if (b.channelIds?.length) {
      const channels = (await postChannels()).filter(c => b.channelIds!.includes(c.id))
      for (const c of channels) {
        const res = await deliver(c.chat, d, c.locale).catch(() => ({ ok: false }))
        if (!res.ok) console.warn(`[broadcast] channel ${c.chat} refused it`)
        await sleep(40)
      }
    }
    const where = reachable(broadcastAudience(b.audience))
    let after = '00000000-0000-0000-0000-000000000000'
    for (;;) {
      const page = await db.select({ id: users.id, chat: users.telegramId, locale: users.locale }).from(users)
        .where(and(where, gt(users.id, after))).orderBy(users.id).limit(500)
      if (!page.length) break
      for (const u of page) {
        const res = await deliver(u.chat!, d, asLocale(u.locale)).catch((e: any) => ({ ok: false, error_code: e?.statusCode }))
        if (res.ok) sent++
        else {
          failed++
          // Blocked the bot: the site asks them to join again, and later broadcasts skip them.
          if ((res as { error_code?: number }).error_code === 403) await db.update(users).set({ telegramBotJoined: false }).where(eq(users.id, u.id))
        }
        if ((sent + failed) % 25 === 0) await save()
        await sleep(40)
      }
      after = page[page.length - 1]!.id
    }
  } catch (e: any) {
    console.error('[broadcast] stopped:', e?.message ?? e)
  }
  await db.update(broadcasts).set({ sent, failed, status: 'DONE', finishedAt: new Date() }).where(eq(broadcasts.id, id))
}

export async function recentBroadcasts() {
  return useDb().select().from(broadcasts).orderBy(desc(broadcasts.createdAt)).limit(30)
}
