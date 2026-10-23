import { and, eq } from 'drizzle-orm'
import { attempts, essays } from '../../../database/schema'

/**
 * The marker's mark (an admin, a marker, or the candidate's centre teacher, markers.ts): a Multilevel score out of 75 or an IELTS band (0–9 in halves) for the section,
 * a word for the candidate, and a comment on each essay. The candidate is told (push and the open
 * page), and sees it on their result.
 */
interface GradeBody { score?: number, band?: number, feedback?: string | null, essays?: { id: string, feedback?: string | null }[] }

export default defineEventHandler(async (event) => {
  const { user: examiner, scope } = await requireMarker(event)
  const id = getRouterParam(event, 'id')!
  await requireMarkable(scope, id)
  const body = await readBody<GradeBody>(event)

  const db = useDb()
  const [attempt] = await db.select().from(attempts).where(eq(attempts.id, id)).limit(1)
  if (!attempt || (attempt.skill !== 'WRITING' && attempt.skill !== 'SPEAKING')) throw createError({ statusCode: 404, message: 'Attempt not found' })

  const ielts = attempt.exam === 'IELTS'
  const band = ielts ? Number(body?.band) : null
  const score = ielts ? null : Math.round(Number(body?.score))
  if (ielts && !isBand(band)) throw createError({ statusCode: 400, message: 'The band is from 0 to 9, in halves' })
  if (!ielts && (!Number.isFinite(score) || score! < 0 || score! > 75)) throw createError({ statusCode: 400, message: 'The score is from 0 to 75' })
  const level = ielts ? bandCefr(band)! : cefrLevel(score!)

  await db.transaction(async (tx) => {
    await tx.update(attempts).set({
      status: 'GRADED', gradedAt: new Date(), score, band, cefrLevel: level,
      feedback: body.feedback?.trim() || null, examinerId: examiner.id
    }).where(eq(attempts.id, id))
    for (const essay of Array.isArray(body.essays) ? body.essays : []) {
      await tx.update(essays).set({ feedback: essay.feedback?.trim() || null }).where(and(eq(essays.id, essay.id), eq(essays.attemptId, id)))
    }
  })

  const label = attempt.skill === 'WRITING' ? 'Writing' : 'Speaking'
  await publishToUser(attempt.userId, { type: 'graded', attemptId: id })
  const result = ielts ? `band ${band!.toFixed(1)}` : `${score}/75`
  await sendPush([attempt.userId], { title: `${label} marked`, body: `Your ${label} scored ${result} (${level}).`, data: { url: `/results/${id}` } }).catch(() => {})
  await notifyMarked(attempt.userId, id, attempt.skill, (band ?? score)!, level, ielts).catch(() => {})
  return attemptView(id, examiner, { marker: true })
})
