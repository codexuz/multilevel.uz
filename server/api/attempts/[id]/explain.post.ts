import { and, eq } from 'drizzle-orm'
import { attempts, sectionItems } from '../../../database/schema'

/**
 * A candidate asks why, in a part of their marked Listening or Reading that has no explanations
 * yet: they are written once, saved with the questions, and every later candidate reads them. It
 * opens the result's explanations (one of today's 10, explanations.ts). { partId }
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (!aiEnabled()) throw createError({ statusCode: 404, message: 'AI is not set up' })
  const id = getRouterParam(event, 'id')!
  const partId = String((await readBody<{ partId?: string }>(event))?.partId ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(partId)) throw createError({ statusCode: 400, message: 'Which part?' })
  const db = useDb()
  const [attempt] = await db.select({ userId: attempts.userId, skill: attempts.skill, sectionId: attempts.sectionId }).from(attempts).where(eq(attempts.id, id)).limit(1)
  // The candidate, staff, or the candidate's teacher.
  const mine = !!attempt && attempt.userId === user.id
  if (!attempt || (!mine && !isStaffRole(user.role) && !(await teachesStudent(user.id, attempt.userId)))) throw createError({ statusCode: 404, message: 'Attempt not found' })
  if ((attempt.skill !== 'READING' && attempt.skill !== 'LISTENING') || !attempt.sectionId) throw createError({ statusCode: 400, message: 'Only Listening and Reading are explained' })
  const [inSection] = await db.select({ id: sectionItems.id }).from(sectionItems).where(and(eq(sectionItems.sectionId, attempt.sectionId), eq(sectionItems.partId, partId))).limit(1)
  if (!inSection) throw createError({ statusCode: 404, message: 'Part not found' })
  if (mine && !isStaffRole(user.role) && !(await openExplanations(attempt.userId, id)).open) {
    throw createError({ statusCode: 429, message: `You have opened explanations on ${explanationsPerDay()} results today. More tomorrow.`, data: { code: 'EXPLANATION_LIMIT' } })
  }
  return explainPart(partId, { userId: user.id })
})
