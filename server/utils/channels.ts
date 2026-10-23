import { asc, eq, sql } from 'drizzle-orm'
import { liveMocks, telegramChannels } from '../database/schema'
import { asLocale, type Locale } from './messages'
import { telegramChannel } from './rewards'
import { telegramApi, telegramBotId } from './telegram'

/**
 * The Telegram channels live mocks are posted to. TELEGRAM_CHANNEL (the one joined for credits) is
 * always one, for the exam TELEGRAM_CHANNEL_EXAM names (MULTILEVEL by default; BOTH for both); admins
 * add more on Live mocks, say one for IELTS. Each mock is posted to the channels picked for it, by
 * default those of its exam, each in the channel's own language.
 */
export interface PostChannel {
  id: string
  chat: string
  title: string
  url: string | null
  /** The exam its readers sit; null: both. */
  exam: Exam | null
  locale: Locale
  /** TELEGRAM_CHANNEL, set on the server rather than here. */
  builtIn: boolean
}

export const DEFAULT_CHANNEL = 'default'

export const asChannelExam = (e?: string | null): Exam | null => (e === 'IELTS' || e === 'MULTILEVEL' ? e : null)

export async function postChannels(): Promise<PostChannel[]> {
  const env = telegramChannel()
  const rows = await useDb().select().from(telegramChannels).orderBy(asc(telegramChannels.createdAt))
  const builtIn: PostChannel[] = env
    ? [{
        id: DEFAULT_CHANNEL,
        chat: env.chat,
        title: env.chat,
        url: env.url,
        exam: asChannelExam(process.env.TELEGRAM_CHANNEL_EXAM ?? 'MULTILEVEL'),
        locale: asLocale(process.env.TELEGRAM_CHANNEL_LOCALE || 'uz'),
        builtIn: true
      }]
    : []
  return [
    ...builtIn,
    ...rows.filter(r => r.chat !== env?.chat).map(r => ({
      id: r.id, chat: r.chat, title: r.title, url: r.url, exam: asChannelExam(r.exam), locale: asLocale(r.locale), builtIn: false
    }))
  ]
}

/** The channels a mock goes to: those picked for it, or, if none were, those of its exam. */
export function channelsOfMock(m: { channelIds: string[] | null }, exam: Exam, all: PostChannel[]) {
  return m.channelIds ? all.filter(c => m.channelIds!.includes(c.id)) : all.filter(c => !c.exam || c.exam === exam)
}

/** Channel ids from a request, kept to the ones that exist. */
export async function pickChannels(ids: unknown): Promise<string[]> {
  if (!Array.isArray(ids)) throw createError({ statusCode: 400, message: 'Pick the channels to post to' })
  const known = new Set((await postChannels()).map(c => c.id))
  return [...new Set(ids.map(String))].filter(id => known.has(id))
}

/** @name, t.me/name or -100… as Telegram takes it. */
export function normalizeChat(input: string) {
  const s = input.trim().replace(/^https?:\/\/(www\.)?t(elegram)?\.me\//i, '').replace(/\/$/, '')
  if (/^-?\d+$/.test(s)) return s
  return `@${s.replace(/^@/, '')}`
}

/**
 * Adds a channel once Telegram confirms it: it exists, and the bot is an admin of it that can post.
 * Its name and link come from Telegram.
 */
export async function addChannel(input: string, exam: Exam | null, locale: Locale) {
  const chat = normalizeChat(input)
  if (chat === '@') throw createError({ statusCode: 400, message: 'Give the channel: @name or its link' })
  const botId = telegramBotId()
  if (!botId) throw createError({ statusCode: 409, message: 'The Telegram bot is not set up (TELEGRAM_BOT_TOKEN)' })
  const info = await telegramApi<{ id: number, type: string, title?: string, username?: string }>('getChat', { chat_id: chat })
    .catch((e: any) => ({ ok: false, description: e?.data?.description || e?.message, result: undefined }))
  if (!info.ok || !info.result) throw createError({ statusCode: 400, message: `Telegram does not know ${chat}, or the bot is not in it. Add the bot to the channel as an admin first.` })
  if (info.result.type !== 'channel' && info.result.type !== 'supergroup') throw createError({ statusCode: 400, message: `${chat} is not a channel` })
  const member = await telegramApi<{ status: string, can_post_messages?: boolean }>('getChatMember', { chat_id: info.result.id, user_id: botId })
    .catch(() => ({ ok: false, result: undefined }))
  const m = member.result
  const canPost = m?.status === 'creator' || (m?.status === 'administrator' && (info.result.type !== 'channel' || m.can_post_messages !== false))
  if (!canPost) throw createError({ statusCode: 400, message: `The bot is not an admin of ${info.result.title ?? chat} that can post messages` })

  const username = info.result.username
  const row = {
    chat: username ? `@${username}` : String(info.result.id),
    title: info.result.title || (username ? `@${username}` : chat),
    url: username ? `https://t.me/${username}` : null,
    exam,
    locale
  }
  if (row.chat === telegramChannel()?.chat) throw createError({ statusCode: 409, message: 'That is TELEGRAM_CHANNEL, already on the list' })
  const [made] = await useDb().insert(telegramChannels).values(row).onConflictDoNothing().returning()
  if (!made) throw createError({ statusCode: 409, message: `${row.title} is already on the list` })
  return made
}

/** Removes a channel, and it from the mocks it was picked for. */
export async function removeChannel(id: string) {
  const db = useDb()
  const [gone] = await db.delete(telegramChannels).where(eq(telegramChannels.id, id)).returning()
  if (!gone) throw createError({ statusCode: 404, message: 'Channel not found' })
  await db.update(liveMocks).set({ channelIds: sql`array_remove(${liveMocks.channelIds}, ${id})` }).where(sql`${id} = any(${liveMocks.channelIds})`)
  return gone
}
