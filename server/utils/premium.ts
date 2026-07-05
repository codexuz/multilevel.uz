import { and, eq, or, gt, isNull } from 'drizzle-orm'
import { subscriptions } from '../database/schema'

/** True if the user has an active, unexpired premium subscription. */
export async function hasActivePremium(userId: string): Promise<boolean> {
  const db = useDb()
  const [row] = await db.select({ id: subscriptions.id }).from(subscriptions)
    .where(and(
      eq(subscriptions.userId, userId),
      eq(subscriptions.plan, 'premium'),
      eq(subscriptions.status, 'active'),
      or(isNull(subscriptions.currentPeriodEnd), gt(subscriptions.currentPeriodEnd, new Date()))
    ))
    .limit(1)
  return !!row
}
