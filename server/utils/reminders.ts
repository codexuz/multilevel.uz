import { and, between, eq, isNull, lt, sql } from 'drizzle-orm'
import { subscriptions } from '../database/schema'

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
