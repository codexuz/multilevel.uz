import { and, eq, asc, inArray } from 'drizzle-orm'
import { attempts, sections, parts, questions, answers } from '../../../database/schema'
import { toStudentQuestion } from '../../../utils/serialize'

// Runner data for an in-progress attempt: section, parts, student questions
// (no correct answers), and any saved answers.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')!
  const db = useDb()

  const [attempt] = await db.select().from(attempts).where(eq(attempts.id, id)).limit(1)
  if (!attempt) throw createError({ statusCode: 404, message: 'Attempt not found' })
  if (attempt.userId !== user.id) throw createError({ statusCode: 403, message: 'Forbidden' })

  const [section] = await db.select().from(sections).where(eq(sections.id, attempt.sectionId)).limit(1)
  const partRows = await db.select().from(parts).where(eq(parts.sectionId, attempt.sectionId)).orderBy(asc(parts.orderIndex))
  const partIds = partRows.map(p => p.id)

  const qRows = partIds.length
    ? await db.select().from(questions).where(inArray(questions.partId, partIds)).orderBy(asc(questions.orderIndex))
    : []
  const ansRows = await db.select().from(answers).where(eq(answers.attemptId, id))

  return {
    attempt: { id: attempt.id, status: attempt.status, startedAt: attempt.startedAt, sectionId: attempt.sectionId },
    section: section && {
      id: section.id, type: section.type, title: section.title,
      durationMinutes: section.durationMinutes, audioUrl: section.audioUrl
    },
    parts: partRows.map(p => ({
      id: p.id, title: p.title, instructions: p.instructions,
      content: p.content, audioUrl: p.audioUrl, imageUrl: p.imageUrl, orderIndex: p.orderIndex
    })),
    questions: qRows.map(toStudentQuestion),
    answers: ansRows.map(a => ({
      questionId: a.questionId,
      response: a.response as string | string[] | null,
      audioUrl: a.audioUrl
    }))
  }
})
