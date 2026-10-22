import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { and, eq, ne } from 'drizzle-orm'
import { users } from '../database/schema'
import { telegramApi, telegramBotToken } from './telegram'
import { mergeToken } from './merge'
import { MSG, asLocale, fromTelegram } from './messages'

/**
 * The Telegram bot's side of things: the link that joins a user to the bot (and, for a Google
 * account, connects their Telegram), and what the bot does with the updates Telegram sends to its
 * webhook. Pressing Start through the link is what marks a user as joined.
 */

const siteUrl = () => String(useRuntimeConfig().public.siteUrl || 'https://mockmee.uz').replace(/\/$/, '')
const LINK_TTL_SECONDS = 24 * 60 * 60

let username: string | null = null
/** The bot's @username (TELEGRAM_BOT_USERNAME, or asked of Telegram once). */
export async function botUsername(): Promise<string | null> {
  if (process.env.TELEGRAM_BOT_USERNAME) return process.env.TELEGRAM_BOT_USERNAME.replace(/^@/, '')
  if (username) return username
  const me = await telegramApi<{ username?: string }>('getMe', {}).catch(() => null)
  username = me?.result?.username ?? null
  return username
}

/** The secret Telegram sends with every webhook call, made from the bot token. */
export const webhookSecret = () => createHash('sha256').update(`webhook:${telegramBotToken()}`).digest('hex').slice(0, 48)

const sign = (body: string) => createHmac('sha256', telegramBotToken() || 'no-bot').update(`start:${body}`).digest('hex').slice(0, 10)

/** `l` + the user id (hex) + when (base 36) + a signature: fits Telegram's 64-character start parameter. */
export function startPayload(userId: string, now = Date.now()) {
  const body = `${userId.replace(/-/g, '')}${Math.floor(now / 1000).toString(36).padStart(7, '0')}`
  return `l${body}${sign(body)}`
}

/** The user a start parameter is for, if it was made here in the last day. */
export function userOfPayload(payload: string, now = Date.now()): string | null {
  const m = /^l([0-9a-f]{32})([0-9a-z]{7})([0-9a-f]{10})$/.exec(payload)
  if (!m) return null
  const body = `${m[1]}${m[2]}`
  const a = Buffer.from(m[3]!)
  const b = Buffer.from(sign(body))
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  if (now / 1000 - Number.parseInt(m[2]!, 36) > LINK_TTL_SECONDS) return null
  const h = m[1]!
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

// ---------- the webhook ----------

const WEBHOOK_PATH = '/api/telegram/webhook'
export interface WebhookInfo { url: string, pending_update_count: number, last_error_date?: number, last_error_message?: string }

export async function webhookInfo() {
  const res = await telegramApi<WebhookInfo>('getWebhookInfo', {}).catch(() => null)
  return res?.ok ? res.result ?? null : null
}

export async function setWebhook(origin: string) {
  return telegramApi('setWebhook', { url: `${origin}${WEBHOOK_PATH}`, secret_token: webhookSecret(), allowed_updates: ['message', 'my_chat_member'] })
}

const checked = new Set<string>()
/**
 * Makes sure Telegram sends the bot's updates to this site at `origin` (the https address users
 * are on), once per address per process. Corrects a webhook left pointing somewhere else, such as
 * a site address that was not set. TELEGRAM_WEBHOOK=false leaves it alone.
 */
export async function ensureWebhook(origin: string) {
  if (!telegramBotToken() || process.env.TELEGRAM_WEBHOOK === 'false' || !origin.startsWith('https://') || checked.has(origin)) return
  checked.add(origin)
  const info = await webhookInfo()
  if (info?.url === `${origin}${WEBHOOK_PATH}`) return
  const res = await setWebhook(origin).catch(e => ({ ok: false, description: e?.data?.description || e?.message }))
  if (res.ok) console.info(`[telegram] webhook set to ${origin}${WEBHOOK_PATH}${info?.url ? ` (was ${info.url})` : ''}`)
  else {
    checked.delete(origin)
    console.warn('[telegram] webhook not set:', res.description)
  }
}

/**
 * Whether the bot can write to this user now, asked of Telegram directly (a "typing" action, which
 * only works once they pressed Start or let the bot write when signing in). Marks them joined if
 * so; does not depend on the webhook.
 */
export async function checkBotJoined(userId: string): Promise<boolean> {
  const db = useDb()
  const [u] = await db.select({ telegramId: users.telegramId, joined: users.telegramBotJoined }).from(users).where(eq(users.id, userId)).limit(1)
  if (!u) return false
  if (u.joined) return true
  if (!u.telegramId || !telegramBotToken()) return false
  const res = await telegramApi('sendChatAction', { chat_id: u.telegramId, action: 'typing' }).catch(() => null)
  if (!res?.ok) return false
  await db.update(users).set({ telegramBotJoined: true }).where(eq(users.id, userId))
  return true
}

/** The link that opens the bot and, on Start, joins this user to it. */
export async function botJoinLink(userId: string) {
  const name = await botUsername()
  return name ? { username: name, url: `https://t.me/${name}?start=${startPayload(userId)}` } : null
}

const reply = (chatId: number | string, text: string, button?: { text: string, url: string }) => telegramApi('sendMessage', {
  chat_id: chatId,
  text,
  parse_mode: 'HTML',
  link_preview_options: { is_disabled: true },
  ...(button ? { reply_markup: { inline_keyboard: [[button]] } } : {})
}).catch(() => null)

interface TgUser { id: number, username?: string, first_name?: string, last_name?: string, language_code?: string }
interface Update {
  message?: { from?: TgUser, chat: { id: number, type: string }, text?: string }
  my_chat_member?: { from: TgUser, chat: { id: number, type: string }, new_chat_member: { status: string } }
}

/** What the bot does with one update from Telegram. */
export async function handleBotUpdate(update: Update) {
  const db = useDb()

  // Blocked or unblocked the bot.
  const member = update.my_chat_member
  if (member && member.chat.type === 'private') {
    const joined = member.new_chat_member.status === 'member'
    await db.update(users).set({ telegramBotJoined: joined }).where(eq(users.telegramId, String(member.from.id)))
    return
  }

  const msg = update.message
  if (!msg?.from || msg.chat.type !== 'private') return
  const telegramId = String(msg.from.id)
  const site = siteUrl()
  // The language they chose on the site, or else their Telegram app's.
  const [known] = await db.select({ locale: users.locale }).from(users).where(eq(users.telegramId, telegramId)).limit(1)
  const l = known?.locale ? asLocale(known.locale) : fromTelegram(msg.from.language_code) ?? 'en'
  const open = { text: MSG.open[l], url: `${site}/tests` }

  if (msg.text?.startsWith('/start')) {
    const userId = userOfPayload(msg.text.split(/\s+/)[1] ?? '')
    if (userId) {
      const [owner] = await db.select({ id: users.id }).from(users).where(and(eq(users.telegramId, telegramId), ne(users.id, userId))).limit(1)
      if (owner) {
        // Whoever holds this Telegram started from the other account's link: offer to merge the two.
        await reply(msg.chat.id, MSG.botMergeOffer[l], { text: MSG.botMergeButton[l], url: `${site}/account/merge?token=${mergeToken(userId, owner.id)}` })
        return
      }
      const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1)
      if (!user) return
      const name = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') || null
      await db.update(users).set({
        telegramId, telegramUsername: msg.from.username ?? null, telegramBotJoined: true,
        name: user.name ?? name, updatedAt: new Date()
      }).where(eq(users.id, userId))
      await reply(msg.chat.id, MSG.botConnectedFromSite[l], open)
      return
    }
    // Start without a link from the site: a user we know is joined; anyone else is shown the way in.
    const updated = await db.update(users).set({ telegramBotJoined: true }).where(eq(users.telegramId, telegramId)).returning({ id: users.id })
    await reply(msg.chat.id, updated.length ? MSG.botConnected[l] : MSG.botWelcome[l], updated.length ? open : { text: MSG.botSignIn[l], url: `${site}/login` })
    return
  }

  // Any message means the chat is open: a user we know is joined.
  await db.update(users).set({ telegramBotJoined: true }).where(eq(users.telegramId, telegramId))
  await reply(msg.chat.id, MSG.botOther[l], open)
}
