import { and, eq, ne } from 'drizzle-orm'
import { aiReviews, attempts } from '../../../database/schema'

// Writing or Speaking SAVED (nobody to mark it then), sent to my teacher now that I am in a class.
// It gets its AI check too, if it had none and today's allowance lasts.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')!
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 404, message: 'Result not found' })
  const db = useDb()
  const [attempt] = await db.select({ userId: attempts.userId, testId: attempts.testId, skill: attempts.skill, status: attempts.status })
    .from(attempts).where(eq(attempts.id, id)).limit(1)
  if (!attempt || attempt.userId !== user.id) throw createError({ statusCode: 404, message: 'Result not found' })
  if (attempt.status !== 'SAVED') throw createError({ statusCode: 409, message: 'This result is already sent for marking' })
  if (!(await inAClass(user.id))) throw createError({ statusCode: 409, message: 'Join your teacher\'s class first: then they can mark it', data: { code: 'NO_TEACHER' } })

  const [row] = await db.update(attempts).set({ status: 'SUBMITTED' })
    .where(and(eq(attempts.id, id), eq(attempts.status, 'SAVED'))).returning({ id: attempts.id })
  if (!row) throw createError({ statusCode: 409, message: 'This result is already sent for marking' })
  await tellTeachersToMark({ id, userId: user.id, skill: attempt.skill }).catch(e => console.error('[marking] teachers not told:', e))

  const [asked] = await db.select({ id: aiReviews.id }).from(aiReviews).where(and(eq(aiReviews.attemptId, id), ne(aiReviews.status, 'FAILED'))).limit(1)
  if (!asked && attempt.skill === 'WRITING') await reviewHandedInWriting({ id, userId: user.id, testId: attempt.testId }, getCookie(event, 'lang')).catch(e => console.error('[ai-writing] auto review failed:', e))
  if (!asked && attempt.skill === 'SPEAKING') await reviewHandedInSpeaking({ id, userId: user.id, testId: attempt.testId }, getCookie(event, 'lang')).catch(e => console.error('[ai-speaking] auto review failed:', e))
  return { id, status: 'SUBMITTED' }
})
