import { and, eq, gt } from 'drizzle-orm'
import { subscriptions } from '../../../../database/schema'

// Ends a user's Premium now (a refund, a mistake); their orders stay as they were.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const userId = getRouterParam(event, 'id')!
  const now = new Date()
  const db = useDb()
  await db.update(subscriptions).set({ endsAt: now }).where(and(eq(subscriptions.userId, userId), gt(subscriptions.endsAt, now)))
  await db.update(subscriptions).set({ startsAt: now }).where(and(eq(subscriptions.userId, userId), gt(subscriptions.startsAt, now)))
  await publishToUser(userId, { type: 'billing' }).catch(() => {})
  return accessOf({ id: userId, role: 'student' })
})
