import { and, count, desc, eq, gt, ilike, inArray, or, sql } from 'drizzle-orm'
import { creditTransactions, rewardTransactions, subscriptions, users } from '../../../database/schema'

// Users, newest first, findable by name, email, Telegram username or id, with their Premium and marking credits.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDb()
  const p = getPagination(event)
  const q = String(getQuery(event).q ?? '').trim()
  const byId = /^[0-9a-f-]{36}$/i.test(q) ? [eq(users.id, q)] : []
  const where = q ? or(...byId, ilike(users.email, `%${q}%`), ilike(users.name, `%${q}%`), ilike(users.telegramUsername, `%${q.replace(/^@/, '')}%`)) : undefined

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
  const rewardRows = ids.length
    ? await db.select({ userId: rewardTransactions.userId, n: sql<number>`sum(${rewardTransactions.delta})::int` }).from(rewardTransactions)
        .where(inArray(rewardTransactions.userId, ids)).groupBy(rewardTransactions.userId)
    : []
  const rewards = new Map(rewardRows.map(r => [r.userId, r.n]))
  const until = new Map(subs.map(s => [s.userId, s.endsAt]))
  const credits = new Map(balances.map(b => [b.userId, b.n]))

  return paginate(rows.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    telegramUsername: u.telegramUsername,
    telegram: !!u.telegramId,
    avatarUrl: u.avatarUrl,
    role: u.role,
    banned: u.banned,
    createdAt: u.createdAt,
    premiumUntil: until.get(u.id) ?? null,
    credits: credits.get(u.id) ?? 0,
    rewardCredits: rewards.get(u.id) ?? 0,
    aiBonusReviews: u.aiBonusReviews
  })), totalRow?.total ?? 0, p)
})
