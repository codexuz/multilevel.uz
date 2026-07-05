import { eq, inArray } from 'drizzle-orm'
import { questions } from '../../../../database/schema'
import type { QuestionType } from '~/types/exam'

interface DraftQuestion {
  id?: string
  type: QuestionType
  questionNumber: number | null
  prompt: string
  options: unknown
  correctAnswer: unknown
  points: number
  meta: unknown
}

// Bulk upsert the questions for a part and delete any removed ones.
export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const partId = getRouterParam(event, 'id')!
  const body = await readBody<{ questions?: DraftQuestion[], removedIds?: string[] }>(event)
  const drafts = body.questions ?? []
  const removedIds = (body.removedIds ?? []).filter(Boolean)

  const db = useDb()

  if (removedIds.length) {
    await db.delete(questions).where(inArray(questions.id, removedIds))
  }

  const saved: { id: string, tempIndex: number }[] = []
  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i]!
    const values = {
      partId,
      type: d.type,
      questionNumber: d.questionNumber,
      prompt: d.prompt,
      options: (d.options ?? []) as never,
      correctAnswer: (d.correctAnswer ?? null) as never,
      points: String(d.points ?? 1),
      meta: (d.meta ?? {}) as never,
      orderIndex: i
    }
    if (d.id) {
      await db.update(questions).set(values).where(eq(questions.id, d.id))
      saved.push({ id: d.id, tempIndex: i })
    } else {
      const [row] = await db.insert(questions).values(values).returning({ id: questions.id })
      saved.push({ id: row!.id, tempIndex: i })
    }
  }

  return { saved }
})
