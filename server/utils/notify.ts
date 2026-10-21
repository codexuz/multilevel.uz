import { eq } from 'drizzle-orm'
import { users } from '../database/schema'
import { telegramApi, telegramBotToken } from './telegram'
import { MSG, asLocale, criterionLabel, typeLabel, type Locale, type Offer } from './messages'

/**
 * Messages from the Telegram bot to a user who signed in with Telegram (they allowed the bot to
 * write when they did) and has not turned them off in Settings. Best effort: a user who blocked
 * the bot, or a bot that is not set up, is skipped quietly.
 */

const siteUrl = () => String(useRuntimeConfig().public.siteUrl || 'https://multilevel.uz').replace(/\/$/, '')

type Message = { text: string, path?: string, button?: string }

/** Sends a message, built in the user's language when `message` is a function of it. */
export async function notifyTelegram(userId: string, message: Message | ((l: Locale) => Message)) {
  if (!telegramBotToken()) return false
  const [u] = await useDb().select({ telegramId: users.telegramId, notify: users.telegramNotify, locale: users.locale }).from(users).where(eq(users.id, userId)).limit(1)
  if (!u?.telegramId || !u.notify) return false
  const m = typeof message === 'function' ? message(asLocale(u.locale)) : message
  const url = m.path ? `${siteUrl()}${m.path}` : null
  const res = await telegramApi('sendMessage', {
    chat_id: u.telegramId,
    text: m.text,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...(url ? { reply_markup: { inline_keyboard: [[{ text: m.button || MSG.open[asLocale(u.locale)], url }]] } } : {})
  }).catch((e: any) => ({ ok: false, error_code: e?.data?.error_code ?? e?.statusCode, description: e?.data?.description || e?.message }))
  if (!res.ok) {
    console.warn('[notify] Telegram message not sent:', res.description)
    // 403: they blocked the bot (or never let it write); the site asks them to join again.
    if ((res as { error_code?: number }).error_code === 403) await useDb().update(users).set({ telegramBotJoined: false }).where(eq(users.id, userId))
  }
  return res.ok
}

export const notifyMarked = (userId: string, attemptId: string, skill: string, score: number, cefr: string) => notifyTelegram(userId, l => ({
  text: MSG.marked(l, skill, score, cefr), path: `/results/${attemptId}`, button: MSG.markedButton[l]
}))

export const notifyAiReview = (userId: string, reviewId: string, attemptId: string | null, score: number, cefr: string, skill = 'WRITING') => notifyTelegram(userId, l => ({
  text: MSG.aiReview(l, skill, score, cefr), path: attemptId ? `/results/${attemptId}` : `/feedback/${reviewId}`, button: MSG.aiReviewButton[l]
}))

export const notifyInviteReward = (userId: string, credits: number) => notifyTelegram(userId, l => ({
  text: MSG.inviteReward(l, credits), path: '/earn', button: MSG.inviteRewardButton[l]
}))

/** A promo offer is worded in the user's language when it is sent. */
type OfferOf = ((l: Locale) => Offer) | null

export const notifyPremiumEnding = (userId: string, endsAt: Date, offer: OfferOf) => notifyTelegram(userId, l => ({
  text: MSG.premiumEnding(l, endsAt, offer?.(l) ?? null), path: `/pricing${offer ? `?promo=${offer(l).code}` : ''}`, button: MSG.premiumEndingButton[l]
}))

export const notifyPremiumEnded = (userId: string, offer: OfferOf) => notifyTelegram(userId, l => ({
  text: MSG.premiumEnded(l, offer?.(l) ?? null), path: `/pricing${offer ? `?promo=${offer(l).code}` : ''}`, button: MSG.premiumEndedButton[l]
}))

interface PlanGoal { kind: 'SECTION' | 'TYPE' | 'CRITERION', skill: string, focus?: { key: string }, done: boolean, to: string }

export function notifyPlan(userId: string, kind: 'MILESTONE' | 'TODAY' | 'NUDGE', daysLeft: number, plan: { goals: PlanGoal[], week: { practisedDays: number, aimDays: number } } | null) {
  return notifyTelegram(userId, (l) => {
    if (kind === 'TODAY') return { text: MSG.planToday[l] }
    const next = plan?.goals.find(g => !g.done)
    const what = next?.kind === 'TYPE' ? typeLabel(l, next.focus?.key ?? '') : next?.kind === 'CRITERION' ? criterionLabel(l, next.focus?.key ?? '') : ''
    const label = next ? (next.kind === 'SECTION' ? MSG.goalSection(l, next.skill) : MSG.goalPractise(l, next.skill, what)) : null
    return {
      text: `${kind === 'MILESTONE' ? MSG.planMilestone(l, daysLeft) : MSG.planNudge(l, daysLeft)}${plan ? MSG.planWeek(l, plan.week.practisedDays, plan.week.aimDays) : ''}${label ? MSG.planNext(l, label) : ''}`,
      path: next?.to ?? '/results',
      button: next ? MSG.planStart[l] : MSG.planSee[l]
    }
  })
}
