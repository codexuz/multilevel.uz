import { and, eq, ne } from 'drizzle-orm'
import { aiReviews, attempts } from '../../../database/schema'

// Writing or Speaking saved without a marking credit (AWAITING_CREDIT), sent to the examiner now:
// one credit spent on it, or none for staff and for a centre's students (their teachers mark them).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')!
  const db = useDb()
  const [attempt] = await db.select({ userId: attempts.userId, testId: attempts.testId, skill: attempts.skill, status: attempts.status })
    .from(attempts).where(eq(attempts.id, id)).limit(1)
  if (!attempt || attempt.userId !== user.id) throw createError({ statusCode: 404, message: 'Result not found' })
  if (attempt.status !== 'AWAITING_CREDIT') throw createError({ statusCode: 409, message: 'This result is already sent for marking' })

  const byTeacher = await studiesAtCentre(user.id)
  const needsCredit = !byTeacher && !isStaffRole(user.role)
  const sent = await db.transaction(async (tx) => {
    if (needsCredit && !(await holdCredits(tx, user.id))) paymentRequired('CREDIT_REQUIRED', 'Marking by an examiner needs a marking credit')
    const [row] = await tx.update(attempts).set({ status: 'SUBMITTED' })
      .where(and(eq(attempts.id, id), eq(attempts.status, 'AWAITING_CREDIT'))).returning({ id: attempts.id })
    if (row && needsCredit) await spendCredit(tx, user.id, id)
    return !!row
  })
  if (!sent) throw createError({ statusCode: 409, message: 'This result is already sent for marking' })

  if (byTeacher) await tellTeachersToMark({ id, userId: user.id, skill: attempt.skill }).catch(e => console.error('[marking] teachers not told:', e))
  // The AI estimate every hand-in gets, unless one was already asked for while it waited.
  const [asked] = await db.select({ id: aiReviews.id }).from(aiReviews).where(and(eq(aiReviews.attemptId, id), ne(aiReviews.status, 'FAILED'))).limit(1)
  if (asked) return { id, status: 'SUBMITTED' }
  if (attempt.skill === 'WRITING') await reviewHandedInWriting({ id, userId: user.id, testId: attempt.testId }, getCookie(event, 'lang')).catch(e => console.error('[ai-writing] auto review failed:', e))
  if (attempt.skill === 'SPEAKING') await reviewHandedInSpeaking({ id, userId: user.id, testId: attempt.testId }, getCookie(event, 'lang')).catch(e => console.error('[ai-speaking] auto review failed:', e))
  return { id, status: 'SUBMITTED' }
})
