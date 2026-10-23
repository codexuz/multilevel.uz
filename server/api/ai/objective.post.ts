import { eq } from 'drizzle-orm'
import { aiReviews, attempts } from '../../database/schema'

/**
 * The AI's analysis of a marked Listening or Reading section (ai-objective.ts): asked once per
 * attempt, then kept. It counts toward the user's AI feedback, like Writing; an attempt with
 * nothing wrong costs nothing. { attemptId } → { id, status }; the page polls /api/ai/reviews/:id.
 */
export default defineEventHandler(async (event) => {
  if (!aiEnabled()) throw createError({ statusCode: 404, message: 'AI feedback is not available' })
  const user = await requireUser(event)
  const attemptId = String((await readBody<{ attemptId?: string }>(event))?.attemptId ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) throw createError({ statusCode: 400, message: 'attemptId is required' })
  const db = useDb()
  const [attempt] = await db.select({ userId: attempts.userId, testId: attempts.testId, skill: attempts.skill }).from(attempts).where(eq(attempts.id, attemptId)).limit(1)
  if (!attempt || attempt.userId !== user.id) throw createError({ statusCode: 404, message: 'Attempt not found' })
  const [existing] = await db.select({ id: aiReviews.id, status: aiReviews.status }).from(aiReviews).where(eq(aiReviews.attemptId, attemptId)).limit(1)
  if (existing && existing.status !== 'FAILED') return existing
  const input = await objectiveInput(attemptId)
  if (!input) throw createError({ statusCode: 400, message: 'Only Listening and Reading are analysed' })
  if (!input.total) throw createError({ statusCode: 400, message: 'There are no questions to analyse' })
  const id = await startWritingReview(user, {
    attemptId, testId: attempt.testId, tasks: input, skill: input.skill,
    free: !input.wrong.length, notify: false, locale: getCookie(event, 'lang')
  })
  return { id, status: 'PENDING' }
})
