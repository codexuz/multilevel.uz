import { and, count, desc, eq, ilike, inArray, or, type SQL } from 'drizzle-orm'
import { attempts, users } from '../../../database/schema'

// Every account's attempts, newest first: findable by the candidate (name, email, @username or id,
// or ?user=<id> for one account), skill and status. Each opens at /results/<id>.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
  const db = useDb()

  const where: SQL[] = []
  const skill = String(query.skill ?? '').toUpperCase()
  if (isSkill(skill)) where.push(eq(attempts.skill, skill))
  if (query.status === 'SUBMITTED' || query.status === 'GRADED') where.push(eq(attempts.status, query.status))
  const userId = String(query.user ?? '')
  if (/^[0-9a-f-]{36}$/i.test(userId)) where.push(eq(attempts.userId, userId))
  const q = String(query.q ?? '').trim()
  if (q) {
    const handle = q.replace(/^@/, '')
    const found = db.select({ id: users.id }).from(users).where(or(
      /^[0-9a-f-]{36}$/i.test(q) ? eq(users.id, q) : undefined,
      ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`), ilike(users.telegramUsername, `%${handle}%`)
    ))
    where.push(inArray(attempts.userId, found))
  }
  const filter = where.length ? and(...where) : undefined

  const [rows, [total], account] = await Promise.all([
    db.query.attempts.findMany({ where: filter, with: { test: true, user: true }, orderBy: [desc(attempts.submittedAt)], limit, offset: (page - 1) * limit }),
    db.select({ n: count() }).from(attempts).where(filter),
    /^[0-9a-f-]{36}$/i.test(userId)
      ? db.select({ id: users.id, name: users.name, email: users.email, telegramUsername: users.telegramUsername }).from(users).where(eq(users.id, userId)).limit(1).then(r => r[0] ?? null)
      : null
  ])
  return {
    ...paged(rows.map(r => ({ ...attemptSummary(r), contact: r.user ? { email: r.user.email, telegramUsername: r.user.telegramUsername, telegram: !!r.user.telegramId } : null })), total?.n ?? 0, page, limit),
    // The account named by ?user=, for the page's heading.
    user: account ? { id: account.id, name: userLabel(account) } : null
  }
})
