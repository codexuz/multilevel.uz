import { and, count, desc, eq, inArray } from 'drizzle-orm'
import { attempts } from '../../../database/schema'

// Writing and Speaking handed in by signed-in candidates: waiting for an examiner, or marked.
export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const query = getQuery(event)
  const status = query.status === 'GRADED' ? 'GRADED' : 'SUBMITTED'
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
  const where = and(eq(attempts.status, status), inArray(attempts.skill, ['WRITING', 'SPEAKING']))
  const db = useDb()
  const [rows, [total]] = await Promise.all([
    db.query.attempts.findMany({ where, with: { test: true, user: true }, orderBy: [desc(attempts.submittedAt)], limit, offset: (page - 1) * limit }),
    db.select({ n: count() }).from(attempts).where(where)
  ])
  return paged(rows.map(attemptSummary), total?.n ?? 0, page, limit)
})
