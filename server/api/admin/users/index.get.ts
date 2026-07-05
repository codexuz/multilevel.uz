import { desc, eq, and, gt, or, isNull } from 'drizzle-orm'
import { users, subscriptions } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDb()

  const rows = await db.select().from(users).orderBy(desc(users.createdAt))

  const activeSubs = await db.select({ userId: subscriptions.userId }).from(subscriptions)
    .where(and(
      eq(subscriptions.status, 'active'),
      eq(subscriptions.plan, 'premium'),
      or(isNull(subscriptions.currentPeriodEnd), gt(subscriptions.currentPeriodEnd, new Date()))
    ))
  const premiumIds = new Set(activeSubs.map(s => s.userId))

  return rows.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatarUrl,
    role: u.role,
    createdAt: u.createdAt,
    isPremium: premiumIds.has(u.id)
  }))
})
