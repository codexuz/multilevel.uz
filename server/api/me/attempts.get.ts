import { count, desc, eq } from 'drizzle-orm'
import { attempts } from '../../database/schema'

// My attempts, newest first (a mock seat's still held: without its marks).
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
  // A mock seat's results held by its session: listed, without the marks, until announced.
  const held = new Set((await Promise.all(rows.filter(r => r.mockCandidateId).map(async r => (await heldFrom(r.id)) ? r.id : null))).filter(Boolean))
  return paged(rows.map(r => (held.has(r.id) ? { ...attemptSummary(r), score: null, band: null, correct: null, cefrLevel: null, held: true } : attemptSummary(r))), total?.n ?? 0, page, limit)
})
