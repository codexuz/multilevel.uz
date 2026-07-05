import { eq } from 'drizzle-orm'
import { attempts, answers } from '../../../database/schema'
import { awardForAttempt } from '../../../utils/gamify'
import { sendPush } from '../../../utils/firebase'

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{
    scores?: Record<string, number>
    feedback?: string
    maxScore?: number
  }>(event)
  const scores = body.scores ?? {}

  const db = useDb()
  const [att] = await db.select().from(attempts).where(eq(attempts.id, id)).limit(1)
  if (!att) throw createError({ statusCode: 404, message: 'Attempt not found' })

  // Persist per-question awarded points onto existing answer rows.
  const ansRows = await db.select().from(answers).where(eq(answers.attemptId, id))
  let total = 0
  for (const a of ansRows) {
    const awarded = Number(scores[a.questionId] ?? 0)
    total += awarded
    await db.update(answers).set({ awardedPoints: String(awarded) }).where(eq(answers.id, a.id))
  }

  await db.update(attempts).set({
    status: 'graded',
    manualScore: String(total),
    totalScore: String(total),
    maxScore: body.maxScore != null ? String(body.maxScore) : att.maxScore,
    examinerId: staff.id,
    feedback: body.feedback ?? null
  }).where(eq(attempts.id, id))

  // Gamification + notify the student their submission was graded.
  await awardForAttempt(att.userId, total)
  await sendPush([att.userId], {
    title: 'Your test was graded',
    body: 'Tap to see your score and feedback.',
    data: { url: `/results/${id}` }
  })

  return { ok: true, total }
})
