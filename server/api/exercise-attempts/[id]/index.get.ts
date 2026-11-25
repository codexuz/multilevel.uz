import { eq } from 'drizzle-orm'
import { exerciseQuestions, users } from '../../../database/schema'

// An exercise attempt for its course's teacher: the student, each written response with its source,
// key points and marking, to review.
export default defineEventHandler(async (event) => {
  const attempt = await findExerciseAttempt(String(getRouterParam(event, 'id')))
  const { exercise } = await requireExerciseTeacher(event, attempt.exerciseId)
  const db = useDb()
  const [[student], questions] = await Promise.all([
    db.select({ name: users.name, telegramUsername: users.telegramUsername, email: users.email, avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, attempt.userId)).limit(1),
    db.select().from(exerciseQuestions).where(eq(exerciseQuestions.exerciseId, exercise.id))
  ])
  const results = attempt.results as Record<string, any>
  const answers = attempt.answers as Record<string, unknown>
  return {
    id: attempt.id,
    exercise: { id: exercise.id, title: exercise.title },
    student: { name: student?.name || (student?.telegramUsername ? `@${student.telegramUsername}` : student?.email) || 'Student', avatarUrl: student?.avatarUrl ?? null },
    score: attempt.score,
    passed: attempt.passed,
    reviewStatus: attempt.reviewStatus,
    submittedAt: attempt.submittedAt,
    written: questions.filter(q => q.type === 'WRITTEN_RESPONSE').sort((a, b) => a.position - b.position).map(q => ({
      id: q.id, prompt: q.prompt, context: q.context, imageRef: q.imageRef, config: q.config, points: q.points,
      answer: String(answers[q.id] ?? ''),
      grade: results[q.id] ?? null
    }))
  }
})
