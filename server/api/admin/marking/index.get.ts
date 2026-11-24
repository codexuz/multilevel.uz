import { and, count, desc, eq } from 'drizzle-orm'
import { attempts } from '../../../database/schema'

// Writing and Speaking handed in for practice: waiting for a marker, or marked. Each marker sees
// what is theirs (markers.ts): an admin may narrow it with ?from=CLASSES|OUTSIDE.
export default defineEventHandler(async (event) => {
  const { scope } = await requireMarker(event)
  const query = getQuery(event)
  const status = query.status === 'GRADED' ? 'GRADED' : 'SUBMITTED'
  const from = query.from === 'CLASSES' || query.from === 'OUTSIDE' ? query.from : undefined
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
  const where = and(eq(attempts.status, status), markableWhere(scope, from))
  const db = useDb()
  const [rows, [total]] = await Promise.all([
    db.query.attempts.findMany({ where, with: { test: true, user: true }, orderBy: [desc(attempts.submittedAt)], limit, offset: (page - 1) * limit }),
    db.select({ n: count() }).from(attempts).where(where)
  ])
  const classOf = await classOfStudents([...new Set(rows.map(r => r.userId))], scope.all ? undefined : scope.userId)
  return {
    ...paged(rows.map(r => ({ ...attemptSummary(r), className: classOf.get(r.userId) ?? null })), total?.n ?? 0, page, limit),
    scope: { all: scope.all, teacher: scope.teacher }
  }
})
