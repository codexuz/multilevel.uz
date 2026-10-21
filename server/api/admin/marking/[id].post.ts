import { and, eq } from 'drizzle-orm'
import { attempts, essays } from '../../../database/schema'

/**
 * The examiner's mark: a Multilevel score out of 75 for the section, a word for the candidate, and
 * a comment on each essay. The candidate is told (push and the open page), and sees it on their result.
 */
interface GradeBody { score: number, feedback?: string | null, essays?: { id: string, feedback?: string | null }[] }

export default defineEventHandler(async (event) => {
  const examiner = await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<GradeBody>(event)
  const score = Math.round(Number(body?.score))
  if (!Number.isFinite(score) || score < 0 || score > 75) throw createError({ statusCode: 400, message: 'The score is from 0 to 75' })

  const db = useDb()
  const [attempt] = await db.select().from(attempts).where(eq(attempts.id, id)).limit(1)
  if (!attempt || (attempt.skill !== 'WRITING' && attempt.skill !== 'SPEAKING')) throw createError({ statusCode: 404, message: 'Attempt not found' })

  await db.transaction(async (tx) => {
    await tx.update(attempts).set({
      status: 'GRADED', gradedAt: new Date(), score, cefrLevel: cefrLevel(score),
      feedback: body.feedback?.trim() || null, examinerId: examiner.id
    }).where(eq(attempts.id, id))
    for (const essay of Array.isArray(body.essays) ? body.essays : []) {
      await tx.update(essays).set({ feedback: essay.feedback?.trim() || null }).where(and(eq(essays.id, essay.id), eq(essays.attemptId, id)))
    }
  })

  const label = attempt.skill === 'WRITING' ? 'Writing' : 'Speaking'
  await publishToUser(attempt.userId, { type: 'graded', attemptId: id })
  await sendPush([attempt.userId], { title: `${label} marked`, body: `Your ${label} scored ${score}/75 (${cefrLevel(score)}).`, data: { url: `/results/${id}` } }).catch(() => {})
  await notifyMarked(attempt.userId, id, attempt.skill, score, cefrLevel(score)).catch(() => {})
  return attemptView(id, examiner)
})
