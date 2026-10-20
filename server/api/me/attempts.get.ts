import { count, desc, eq } from 'drizzle-orm'
import { attempts } from '../../database/schema'

// My attempts, newest first.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
  const db = useDb()
  const [rows, [total]] = await Promise.all([
    db.query.attempts.findMany({ where: eq(attempts.userId, user.id), with: { test: true }, orderBy: [desc(attempts.submittedAt)], limit, offset: (page - 1) * limit }),
    db.select({ n: count() }).from(attempts).where(eq(attempts.userId, user.id))
  ])
  return paged(rows.map(attemptSummary), total?.n ?? 0, page, limit)
})
