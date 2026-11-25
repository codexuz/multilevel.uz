import { eq } from 'drizzle-orm'
import { exerciseAttempts, exerciseQuestions } from '../../../database/schema'

// The teacher's mark for a written response in an attempt: { questionId, score (0..100), comment? }.
// The attempt's score and pass are worked out again.
export default defineEventHandler(async (event) => {
  const attempt = await findExerciseAttempt(String(getRouterParam(event, 'id')))
  const { exercise } = await requireExerciseTeacher(event, attempt.exerciseId)
  const b = (await readBody<{ questionId?: string, score?: number, comment?: string }>(event)) ?? {}
  const db = useDb()
  const questions = await db.select().from(exerciseQuestions).where(eq(exerciseQuestions.exerciseId, exercise.id))
  const q = questions.find(x => x.id === b.questionId && x.type === 'WRITTEN_RESPONSE')
  if (!q) throw createError({ statusCode: 400, message: 'Pick a written response of this exercise' })
  const score = Math.round(Number(b.score))
  if (!Number.isFinite(score) || score < 0 || score > 100) throw createError({ statusCode: 400, message: 'A mark is 0 to 100' })
  const results = structuredClone(attempt.results as Record<string, any>)
  const grade = results[q.id] ?? { earned: 0, max: q.points, isCorrect: false }
  grade.review = { words: 0, ...grade.review, status: 'TEACHER', score, teacherComment: String(b.comment ?? '').trim().slice(0, 2000) || undefined }
  grade.earned = Math.round(score / 100 * grade.max)
  grade.isCorrect = score >= 70
  results[q.id] = grade
  const earnedPoints = Object.values(results).reduce((n: number, g: any) => n + (g.earned ?? 0), 0)
  const totalPoints = Object.values(results).reduce((n: number, g: any) => n + (g.max ?? 0), 0)
  const pct = totalPoints ? Math.round(earnedPoints / totalPoints * 100) : 100
  // Done once every written response has the teacher's mark.
  const writtenIds = questions.filter(x => x.type === 'WRITTEN_RESPONSE').map(x => x.id)
  const allTeacher = writtenIds.every(id => results[id]?.review?.status === 'TEACHER')
  const [updated] = await db.update(exerciseAttempts).set({
    results, earnedPoints, totalPoints, score: pct, passed: pct >= exercise.passingScore,
    reviewStatus: allTeacher ? 'TEACHER' : (writtenIds.some(id => results[id]?.review?.status === 'PENDING') ? 'PENDING' : 'AI')
  }).where(eq(exerciseAttempts.id, attempt.id)).returning()
  return { score: updated!.score, passed: updated!.passed, reviewStatus: updated!.reviewStatus, grade }
})
