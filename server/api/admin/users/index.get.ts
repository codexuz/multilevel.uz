import { and, count, desc, gt, ilike, inArray, or, sql } from 'drizzle-orm'
import { creditTransactions, subscriptions, users } from '../../../database/schema'

// Users, newest first, findable by name or email, with their Premium and marking credits.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDb()
  const p = getPagination(event)
  const q = String(getQuery(event).q ?? '').trim()
  const where = q ? or(ilike(users.email, `%${q}%`), ilike(users.name, `%${q}%`)) : undefined

  const [totalRow] = await db.select({ total: count() }).from(users).where(where)
  const rows = await db.select().from(users).where(where)
    .orderBy(desc(users.createdAt))
    .limit(p.pageSize).offset(p.offset)

  const ids = rows.map(u => u.id)
  const [subs, balances] = ids.length
    ? await Promise.all([
        db.select({ userId: subscriptions.userId, endsAt: sql<string>`max(${subscriptions.endsAt})` }).from(subscriptions)
          .where(and(inArray(subscriptions.userId, ids), gt(subscriptions.endsAt, new Date()))).groupBy(subscriptions.userId),
        db.select({ userId: creditTransactions.userId, n: sql<number>`sum(${creditTransactions.delta})::int` }).from(creditTransactions)
          .where(inArray(creditTransactions.userId, ids)).groupBy(creditTransactions.userId)
      ])
    : [[], []]
  const until = new Map(subs.map(s => [s.userId, s.endsAt]))
  const credits = new Map(balances.map(b => [b.userId, b.n]))

  return paginate(rows.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatarUrl,
    role: u.role,
    banned: u.banned,
    createdAt: u.createdAt,
    premiumUntil: until.get(u.id) ?? null,
    credits: credits.get(u.id) ?? 0
  })), totalRow?.total ?? 0, p)
})
