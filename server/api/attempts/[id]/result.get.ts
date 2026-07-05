import { eq, asc, inArray } from 'drizzle-orm'
import { attempts, sections, tests, parts, questions, answers } from '../../../database/schema'
import { toStudentQuestion, num } from '../../../utils/serialize'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')!
  const db = useDb()

  const [attempt] = await db.select().from(attempts).where(eq(attempts.id, id)).limit(1)
  if (!attempt) throw createError({ statusCode: 404, message: 'Attempt not found' })
  if (attempt.userId !== user.id && user.role === 'student') throw createError({ statusCode: 403, message: 'Forbidden' })

  const [section] = await db.select().from(sections).where(eq(sections.id, attempt.sectionId)).limit(1)
  const [test] = await db.select().from(tests).where(eq(tests.id, attempt.testId)).limit(1)

  const partRows = await db.select({ id: parts.id }).from(parts).where(eq(parts.sectionId, attempt.sectionId)).orderBy(asc(parts.orderIndex))
  const partIds = partRows.map(p => p.id)
  const qRows = partIds.length
    ? await db.select().from(questions).where(inArray(questions.partId, partIds)).orderBy(asc(questions.orderIndex))
    : []
  const ansRows = await db.select().from(answers).where(eq(answers.attemptId, id))

  return {
    attempt: {
      id: attempt.id,
      status: attempt.status,
      testId: attempt.testId,
      totalScore: num(attempt.totalScore),
      manualScore: num(attempt.manualScore),
      maxScore: num(attempt.maxScore),
      feedback: attempt.feedback,
      createdAt: attempt.createdAt
    },
    section: section && { id: section.id, type: section.type, title: section.title },
    testTitle: test?.title ?? '',
    questions: qRows.map(toStudentQuestion),
    answers: ansRows.map(a => ({
      questionId: a.questionId,
      response: a.response as string | string[] | null,
      isCorrect: a.isCorrect,
      awardedPoints: num(a.awardedPoints)
    }))
  }
})
