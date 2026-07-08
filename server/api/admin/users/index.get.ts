import { desc, eq, and, gt, or, isNull, inArray, count } from 'drizzle-orm'
import { users, subscriptions } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDb()
  const p = getPagination(event)

  const [totalRow] = await db.select({ total: count() }).from(users)
  const rows = await db.select().from(users)
    .orderBy(desc(users.createdAt))
    .limit(p.pageSize).offset(p.offset)

  // Premium lookup scoped to just this page's users.
  const ids = rows.map(u => u.id)
  const activeSubs = ids.length
    ? await db.select({ userId: subscriptions.userId }).from(subscriptions)
        .where(and(
          inArray(subscriptions.userId, ids),
          eq(subscriptions.status, 'active'),
          eq(subscriptions.plan, 'premium'),
          or(isNull(subscriptions.currentPeriodEnd), gt(subscriptions.currentPeriodEnd, new Date()))
        ))
    : []
  const premiumIds = new Set(activeSubs.map(s => s.userId))

  return paginate(rows.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatarUrl,
    role: u.role,
    createdAt: u.createdAt,
    isPremium: premiumIds.has(u.id)
  })), totalRow?.total ?? 0, p)
})
