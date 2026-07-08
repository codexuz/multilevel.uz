import { eq, inArray } from 'drizzle-orm'
import { attempts, sections, parts, questions, answers } from '../../../database/schema'
import { num } from '../../../utils/serialize'
import { gradeQuestion } from '../../../utils/grade'
import { scaledScore, cefrLevel } from '../../../utils/score'
import { awardForAttempt } from '../../../utils/gamify'

// Submit an attempt. Listening/Reading are auto-graded server-side (correct answers
// stay on the server). Writing/Speaking go to the examiner queue.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')!
  const db = useDb()

  const [attempt] = await db.select().from(attempts).where(eq(attempts.id, id)).limit(1)
  if (!attempt) throw createError({ statusCode: 404, message: 'Attempt not found' })
  if (attempt.userId !== user.id) throw createError({ statusCode: 403, message: 'Forbidden' })
  if (attempt.status !== 'in_progress') throw createError({ statusCode: 409, message: 'Already submitted' })

  const [section] = await db.select().from(sections).where(eq(sections.id, attempt.sectionId)).limit(1)
  const objective = section?.type === 'listening' || section?.type === 'reading'
  const now = new Date()

  if (objective) {
    const partRows = await db.select({ id: parts.id }).from(parts).where(eq(parts.sectionId, attempt.sectionId))
    const partIds = partRows.map(p => p.id)
    const qRows = partIds.length
      ? await db.select().from(questions).where(inArray(questions.partId, partIds))
      : []
    const ansRows = await db.select().from(answers).where(eq(answers.attemptId, id))
    const ansByQ = new Map(ansRows.map(a => [a.questionId, a]))

    let correctCount = 0
    for (const q of qRows) {
      const pts = num(q.points) ?? 0
      const ans = ansByQ.get(q.id)
      const correct = ans ? gradeQuestion(q.type, q.correctAnswer as never, ans.response as never) : false
      if (correct) correctCount++
      const awarded = correct ? pts : 0
      if (ans) {
        await db.update(answers).set({ isCorrect: correct, awardedPoints: String(awarded) }).where(eq(answers.id, ans.id))
      }
    }

    // Convert raw correct count → Multilevel scaled score (0–75) + CEFR band.
    const scaled = scaledScore(section!.type as 'listening' | 'reading', correctCount)
    const level = cefrLevel(scaled)

    await db.update(attempts).set({
      status: 'graded', submittedAt: now,
      autoScore: String(correctCount), totalScore: String(scaled), maxScore: '75'
    }).where(eq(attempts.id, id))

    const gam = await awardForAttempt(user.id, correctCount)
    return { status: 'graded', correctCount, totalQuestions: qRows.length, scaled, level, maxScore: 75, gamification: gam }
  }

  // Writing / Speaking → examiner grading
  await db.update(attempts).set({ status: 'submitted', submittedAt: now }).where(eq(attempts.id, id))
  return { status: 'submitted' }
})
