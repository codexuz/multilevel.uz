import { eq } from 'drizzle-orm'
import { aiReviews, attempts } from '../../../database/schema'

// The AI review of a saved attempt, if there is one (?attemptId=).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const attemptId = String(getQuery(event).attemptId ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) throw createError({ statusCode: 400, message: 'attemptId is required' })
  const db = useDb()
  const [attempt] = await db.select({ userId: attempts.userId }).from(attempts).where(eq(attempts.id, attemptId)).limit(1)
  if (!attempt || (attempt.userId !== user.id && !isStaffRole(user.role))) throw createError({ statusCode: 404, message: 'Not found' })
  const [row] = await db.select({ id: aiReviews.id }).from(aiReviews).where(eq(aiReviews.attemptId, attemptId)).limit(1)
  return row ? await aiReviewView(row.id) : null
})
