import { and, eq } from 'drizzle-orm'
import { attempts, sectionItems } from '../../../database/schema'

/**
 * A candidate (with Premium, since explanations are Premium) asks why, in a part of their marked
 * Listening or Reading that has no explanations yet: they are written once, saved with the
 * questions, and every later candidate reads them for free. { partId }
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (!aiEnabled()) throw createError({ statusCode: 404, message: 'AI is not set up' })
  const id = getRouterParam(event, 'id')!
  const partId = String((await readBody<{ partId?: string }>(event))?.partId ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(partId)) throw createError({ statusCode: 400, message: 'Which part?' })
  const db = useDb()
  const [attempt] = await db.select({ userId: attempts.userId, skill: attempts.skill, sectionId: attempts.sectionId }).from(attempts).where(eq(attempts.id, id)).limit(1)
  if (!attempt || (attempt.userId !== user.id && !isStaffRole(user.role))) throw createError({ statusCode: 404, message: 'Attempt not found' })
  if ((attempt.skill !== 'READING' && attempt.skill !== 'LISTENING') || !attempt.sectionId) throw createError({ statusCode: 400, message: 'Only Listening and Reading are explained' })
  const [inSection] = await db.select({ id: sectionItems.id }).from(sectionItems).where(and(eq(sectionItems.sectionId, attempt.sectionId), eq(sectionItems.partId, partId))).limit(1)
  if (!inSection) throw createError({ statusCode: 404, message: 'Part not found' })
  if (!(await accessOf(user)).premium) paymentRequired('PREMIUM_REQUIRED', 'Explanations are part of Premium')
  return explainPart(partId, { userId: user.id })
})
