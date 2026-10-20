import { and, count, countDistinct, eq, gt, gte, sql } from 'drizzle-orm'
import { attempts, orders, subscriptions, tests, users } from '../../database/schema'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const db = useDb()
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

  const [[t], [p], [g], [s], [a], [premium], [month]] = await Promise.all([
    db.select({ n: count() }).from(tests),
    db.select({ n: count() }).from(tests).where(eq(tests.status, 'PUBLISHED')),
    db.select({ n: count() }).from(attempts).where(eq(attempts.status, 'SUBMITTED')),
    db.select({ n: count() }).from(users).where(eq(users.role, 'student')),
    db.select({ n: count() }).from(attempts),
    db.select({ n: countDistinct(subscriptions.userId) }).from(subscriptions).where(gt(subscriptions.endsAt, new Date())),
    db.select({ sum: sql<number>`coalesce(sum(${orders.amountUzs}), 0)::int` }).from(orders)
      .where(and(eq(orders.status, 'PAID'), gte(orders.paidAt, monthStart)))
  ])

  return {
    tests: t?.n ?? 0,
    published: p?.n ?? 0,
    pendingMarking: g?.n ?? 0,
    students: s?.n ?? 0,
    attempts: a?.n ?? 0,
    premiumUsers: premium?.n ?? 0,
    revenueThisMonthUzs: month?.sum ?? 0
  }
})
