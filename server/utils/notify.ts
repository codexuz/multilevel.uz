import { eq } from 'drizzle-orm'
import { users } from '../database/schema'
import { telegramApi, telegramBotToken } from './telegram'

/**
 * Messages from the Telegram bot to a user who signed in with Telegram (they allowed the bot to
 * write when they did) and has not turned them off in Settings. Best effort: a user who blocked
 * the bot, or a bot that is not set up, is skipped quietly.
 */

const siteUrl = () => String(useRuntimeConfig().public.siteUrl || 'https://multilevel.uz').replace(/\/$/, '')

export async function notifyTelegram(userId: string, message: { text: string, path?: string, button?: string }) {
  if (!telegramBotToken()) return false
  const [u] = await useDb().select({ telegramId: users.telegramId, notify: users.telegramNotify }).from(users).where(eq(users.id, userId)).limit(1)
  if (!u?.telegramId || !u.notify) return false
  const url = message.path ? `${siteUrl()}${message.path}` : null
  const res = await telegramApi('sendMessage', {
    chat_id: u.telegramId,
    text: message.text,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...(url ? { reply_markup: { inline_keyboard: [[{ text: message.button || 'Open', url }]] } } : {})
  }).catch((e: any) => ({ ok: false, description: e?.data?.description || e?.message }))
  if (!res.ok) console.warn('[notify] Telegram message not sent:', res.description)
  return res.ok
}

const skillWord = (skill: string) => (skill === 'WRITING' ? 'Writing' : skill === 'SPEAKING' ? 'Speaking' : skill.charAt(0) + skill.slice(1).toLowerCase())
const level = (l: string) => (l === 'A2' || l === 'A1' ? 'below B1' : l)

export const notifyMarked = (userId: string, attemptId: string, skill: string, score: number, cefr: string) => notifyTelegram(userId, {
  text: `✅ <b>Your ${skillWord(skill)} is marked</b>\nScore: <b>${score}/75</b> (${level(cefr)}). The examiner's feedback is waiting for you.`,
  path: `/results/${attemptId}`,
  button: 'See the feedback'
})

export const notifyAiReview = (userId: string, reviewId: string, attemptId: string | null, score: number, cefr: string) => notifyTelegram(userId, {
  text: `✨ <b>Your AI feedback is ready</b>\nEstimated Writing score: <b>${score}/75</b> (${level(cefr)}), with corrections for each task.`,
  path: attemptId ? `/results/${attemptId}` : `/feedback/${reviewId}`,
  button: 'Read it'
})

export const notifyInviteReward = (userId: string, credits: number) => notifyTelegram(userId, {
  text: `🎁 <b>+${credits} ${credits === 1 ? 'credit' : 'credits'}</b>\nA friend you invited finished their first test. Use credits to open Premium tests.`,
  path: '/earn',
  button: 'See my credits'
})
