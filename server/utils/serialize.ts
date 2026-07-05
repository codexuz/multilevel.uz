import type { Choice, QuestionMeta } from '~/types/exam'

/** Drizzle `numeric` columns come back as strings; coerce to number|null. */
export function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

interface QuestionRow {
  id: string
  partId: string
  orderIndex: number
  questionNumber: number | null
  type: string
  prompt: string | null
  options: unknown
  correctAnswer?: unknown
  points: string | number
  meta: unknown
}

/** Strip correctAnswer and coerce for student consumption. */
export function toStudentQuestion(q: QuestionRow) {
  return {
    id: q.id,
    partId: q.partId,
    orderIndex: q.orderIndex,
    questionNumber: q.questionNumber,
    type: q.type,
    prompt: q.prompt,
    options: (q.options ?? []) as Choice[],
    points: num(q.points) ?? 0,
    meta: (q.meta ?? {}) as QuestionMeta
  }
}
