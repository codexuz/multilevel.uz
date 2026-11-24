import type { SQL } from 'drizzle-orm'
import { and, asc, count, desc, eq, gt, ilike, inArray, or, sql } from 'drizzle-orm'
import { mockCreditTransactions, rewardTransactions, subscriptions, users } from '../../../database/schema'

const ROLES = ['student', 'teacher', 'admin'] as const
/** Premium: paid for and running. */
const PREMIUM = sql`exists (select 1 from ${subscriptions} s where s.user_id = ${users.id} and s.ends_at > now())`
const SORTS: Record<string, SQL[]> = {
  NEWEST: [desc(users.createdAt)],
  OLDEST: [asc(users.createdAt)],
  NAME: [sql`lower(coalesce(${users.name}, ${users.email}, ''))`, desc(users.createdAt)]
}

/**
 * Users, a page at a time, findable by name, email, Telegram username or id, and narrowed by
 * ?role, ?plan=PREMIUM|FREE, ?status=ACTIVE|BANNED and ?telegram=1; ?sort=NEWEST|OLDEST|NAME.
 * Each with what they hold: Premium (bought before subscriptions stopped), test credits, extra AI checks and mock credits.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDb()
  const p = getPagination(event, 20, 100)
  const query = getQuery(event)
  const q = String(query.q ?? '').trim()
  const byId = /^[0-9a-f-]{36}$/i.test(q) ? [eq(users.id, q)] : []
  const role = ROLES.find(r => r === query.role)
  // Walk-ins' accounts for mock sessions are not users of the site: left out.
  const where = and(
    eq(users.mockOnly, false),
    q ? or(...byId, ilike(users.email, `%${q}%`), ilike(users.name, `%${q}%`), ilike(users.telegramUsername, `%${q.replace(/^@/, '')}%`)) : undefined,
    role ? eq(users.role, role) : undefined,
    query.plan === 'PREMIUM' ? PREMIUM : query.plan === 'FREE' ? sql`not ${PREMIUM}` : undefined,
    query.status === 'BANNED' ? eq(users.banned, true) : query.status === 'ACTIVE' ? eq(users.banned, false) : undefined,
    query.telegram === '1' ? sql`${users.telegramId} is not null` : undefined
  )

  const [totalRow] = await db.select({ total: count() }).from(users).where(where)
  const rows = await db.select().from(users).where(where)
    .orderBy(...(SORTS[String(query.sort)] ?? SORTS.NEWEST!))
    .limit(p.pageSize).offset(p.offset)

  const ids = rows.map(u => u.id)
  const total = (n: SQL) => sql<number>`sum(${n})::int`
  const [subs, rewards, mock] = ids.length
    ? await Promise.all([
        db.select({ userId: subscriptions.userId, endsAt: sql<string>`max(${subscriptions.endsAt})` }).from(subscriptions)
          .where(and(inArray(subscriptions.userId, ids), gt(subscriptions.endsAt, new Date()))).groupBy(subscriptions.userId),
        db.select({ userId: rewardTransactions.userId, n: total(sql`${rewardTransactions.delta}`) }).from(rewardTransactions)
          .where(inArray(rewardTransactions.userId, ids)).groupBy(rewardTransactions.userId),
        // A teacher's mock credits.
        db.select({ userId: mockCreditTransactions.userId, n: total(sql`${mockCreditTransactions.delta}`) }).from(mockCreditTransactions)
          .where(inArray(mockCreditTransactions.userId, ids)).groupBy(mockCreditTransactions.userId)
      ])
    : [[], [], []]
  const until = new Map(subs.map(s => [s.userId, s.endsAt]))
  const by = (list: { userId: string | null, n: number }[]) => new Map(list.map(r => [r.userId, r.n]))
  const [testCredits, mockCredits] = [by(rewards), by(mock)]

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
    rewardCredits: testCredits.get(u.id) ?? 0,
    aiBonusReviews: u.aiBonusReviews,
    mockCredits: mockCredits.get(u.id) ?? 0
  })), totalRow?.total ?? 0, p)
})
