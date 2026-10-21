import { and, between, desc, eq, gte, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'
import { attempts, subscriptions, users } from '../database/schema'
import { daysBetween, planOf, tashkentToday } from './study-plan'

/**
 * Premium about to end, and just ended: one Telegram message each, for a user's latest stretch of
 * Premium (not one that a later purchase already follows). PREMIUM_RENEW_PROMO, if set, is a promo
 * code offered in both messages (only to users who can still use it).
 */

const latestStretch = sql`not exists (select 1 from subscriptions later where later.user_id = ${subscriptions.userId} and later.ends_at > ${subscriptions.endsAt})`

async function renewOffer(userId: string) {
  const code = process.env.PREMIUM_RENEW_PROMO
  if (!code) return null
  return usablePromo(code, userId).then(p => ({ code: p.code, text: promoText(p) })).catch(() => null)
}

export async function sendPremiumReminders(now = new Date()) {
  const db = useDb()
  const day = 86_400_000
  let before = 0
  let after = 0

  // Ends within three days (and has run for at least a day: not a short gift that just started).
  const ending = await db.select().from(subscriptions).where(and(
    between(subscriptions.endsAt, now, new Date(now.getTime() + 3 * day)),
    lt(subscriptions.startsAt, new Date(now.getTime() - day)),
    isNull(subscriptions.remindedBeforeAt), latestStretch
  ))
  for (const s of ending) {
    await db.update(subscriptions).set({ remindedBeforeAt: now }).where(eq(subscriptions.id, s.id))
    if (await notifyPremiumEnding(s.userId, s.endsAt, await renewOffer(s.userId)).catch(() => false)) before++
  }

  // Ended in the last two days.
  const ended = await db.select().from(subscriptions).where(and(
    between(subscriptions.endsAt, new Date(now.getTime() - 2 * day), now),
    isNull(subscriptions.remindedAfterAt), latestStretch
  ))
  for (const s of ended) {
    await db.update(subscriptions).set({ remindedAfterAt: now }).where(eq(subscriptions.id, s.id))
    if (await notifyPremiumEnded(s.userId, await renewOffer(s.userId)).catch(() => false)) after++
  }
  return { before, after }
}

/**
 * Exam plan reminders, once a morning (Tashkent): on the milestones before the exam (60, 30, 14, 7,
 * 3 days and the day before), good luck on the day, and a nudge after three days without practice
 * (at most every three days). Each names the next goal of the week. At most one message a day.
 */
const MILESTONES = [60, 30, 14, 7, 3, 1]

export async function sendPlanReminders(now = Date.now()) {
  const db = useDb()
  const today = tashkentToday(now)
  const due = await db.select({ id: users.id, role: users.role, examDate: users.examDate, remindedOn: users.planRemindedOn }).from(users).where(and(
    gte(users.examDate, today), isNotNull(users.telegramId), eq(users.telegramNotify, true), eq(users.banned, false),
    or(isNull(users.planRemindedOn), lt(users.planRemindedOn, today))
  )).limit(1000)
  let sent = 0
  for (const u of due) {
    const daysLeft = daysBetween(today, u.examDate!)
    let kind: 'MILESTONE' | 'TODAY' | 'NUDGE' | null = daysLeft === 0 ? 'TODAY' : MILESTONES.includes(daysLeft) ? 'MILESTONE' : null
    if (!kind && (!u.remindedOn || daysBetween(u.remindedOn, today) >= 3)) {
      const [last] = await db.select({ at: attempts.submittedAt }).from(attempts).where(eq(attempts.userId, u.id)).orderBy(desc(attempts.submittedAt)).limit(1)
      if (!last || daysBetween(tashkentToday(last.at.getTime()), today) >= 3) kind = 'NUDGE'
    }
    if (!kind) continue
    await db.update(users).set({ planRemindedOn: today }).where(eq(users.id, u.id))
    const plan = kind === 'TODAY' ? null : await planOf({ id: u.id, role: u.role }, now).catch(() => null)
    if (await notifyPlan(u.id, kind, daysLeft, plan).catch(() => false)) sent++
  }
  return { checked: due.length, sent }
}
