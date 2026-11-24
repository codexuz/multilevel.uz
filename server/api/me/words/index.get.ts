import { and, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from 'drizzle-orm'
import { attempts, sectionItems, userWords } from '../../../database/schema'

/**
 * My saved words, newest first. ?q= searches them; ?attempt= gives the ones I saved while sitting
 * that attempt (from its parts, between its start and its hand-in), for its result page.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const db = useDb()
  const where: SQL[] = [eq(userWords.userId, user.id)]

  const q = String(query.q ?? '').trim().slice(0, 60)
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, m => `\\${m}`)}%`
    where.push(or(ilike(userWords.term, like), ilike(userWords.definition, like), ilike(userWords.translation, like))!)
  }

  if (query.attempt) {
    const id = String(query.attempt)
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 400, message: 'Not an attempt id' })
    const [attempt] = await db.select({ sectionId: attempts.sectionId, startedAt: attempts.startedAt, submittedAt: attempts.submittedAt })
      .from(attempts).where(and(eq(attempts.id, id), eq(attempts.userId, user.id))).limit(1)
    if (!attempt?.sectionId) return { items: [], total: 0, page: 1, pageSize: 0, totalPages: 1 }
    const partIds = (await db.select({ id: sectionItems.partId }).from(sectionItems).where(eq(sectionItems.sectionId, attempt.sectionId)))
      .map(r => r.id).filter((id): id is string => !!id)
    if (!partIds.length) return { items: [], total: 0, page: 1, pageSize: 0, totalPages: 1 }
    const from = attempt.startedAt ?? new Date(attempt.submittedAt.getTime() - 4 * 3_600_000)
    where.push(inArray(userWords.partId, partIds), gte(userWords.createdAt, from), lte(userWords.createdAt, new Date(attempt.submittedAt.getTime() + 60_000)))
  }

  const p = getPagination(event, 50, 200)
  const [rows, [count]] = await Promise.all([
    db.select().from(userWords).where(and(...where)).orderBy(desc(userWords.createdAt)).limit(p.pageSize).offset(p.offset),
    db.select({ n: sql<number>`count(*)::int` }).from(userWords).where(and(...where))
  ])
  return paginate(rows.map(wordView), count?.n ?? 0, p)
})
