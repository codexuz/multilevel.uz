import { eq, asc, inArray } from 'drizzle-orm'
import { attempts, sections, tests, parts, questions, answers } from '../../../database/schema'
import { toStudentQuestion, num } from '../../../utils/serialize'
import { cefrLevel } from '../../../utils/score'

// Answer review for a finished objective attempt. Unlike the runner and result
// endpoints this one *does* send correctAnswer — it is only reachable once the
// attempt has been graded, so nothing can be leaked into a live exam.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')!
  const db = useDb()

  const [attempt] = await db.select().from(attempts).where(eq(attempts.id, id)).limit(1)
  if (!attempt) throw createError({ statusCode: 404, message: 'Attempt not found' })
  if (attempt.userId !== user.id && user.role === 'student') throw createError({ statusCode: 403, message: 'Forbidden' })
  if (attempt.status !== 'graded') throw createError({ statusCode: 409, message: 'Attempt has not been graded yet' })

  const [section] = await db.select().from(sections).where(eq(sections.id, attempt.sectionId)).limit(1)
  if (section?.type !== 'listening' && section?.type !== 'reading') {
    throw createError({ statusCode: 400, message: 'Review is only available for listening and reading' })
  }

  const [test] = await db.select().from(tests).where(eq(tests.id, attempt.testId)).limit(1)

  const partRows = await db.select().from(parts).where(eq(parts.sectionId, attempt.sectionId)).orderBy(asc(parts.orderIndex))
  const partIds = partRows.map(p => p.id)
  const qRows = partIds.length
    ? await db.select().from(questions).where(inArray(questions.partId, partIds)).orderBy(asc(questions.orderIndex))
    : []
  const ansRows = await db.select().from(answers).where(eq(answers.attemptId, id))

  const scaled = num(attempt.totalScore)

  return {
    attempt: {
      id: attempt.id,
      status: attempt.status,
      testId: attempt.testId,
      totalScore: scaled,
      maxScore: num(attempt.maxScore) ?? 75,
      correctCount: num(attempt.autoScore),
      totalQuestions: qRows.length,
      level: scaled != null ? cefrLevel(scaled) : null,
      createdAt: attempt.createdAt
    },
    section: {
      id: section.id,
      type: section.type,
      title: section.title,
      audioUrl: section.audioUrl,
      videoExplanationUrl: section.videoExplanationUrl
    },
    testTitle: test?.title ?? '',
    parts: partRows.map(p => ({
      id: p.id,
      sectionId: p.sectionId,
      title: p.title,
      instructions: p.instructions,
      content: p.content,
      audioUrl: p.audioUrl,
      imageUrl: p.imageUrl,
      orderIndex: p.orderIndex
    })),
    questions: qRows.map(q => ({ ...toStudentQuestion(q), correctAnswer: q.correctAnswer })),
    answers: ansRows.map(a => ({
      questionId: a.questionId,
      response: a.response as string | string[] | null,
      isCorrect: a.isCorrect,
      awardedPoints: num(a.awardedPoints)
    }))
  }
})
