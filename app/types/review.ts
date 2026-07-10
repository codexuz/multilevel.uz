import type { SectionType } from '~/types/exam'
import type { PartDto, QuestionDto } from '~/types/models'

export interface ReviewAnswer {
  questionId: string
  response: string | string[] | null
  isCorrect: boolean | null
  awardedPoints: number | null
}

export interface ReviewData {
  attempt: {
    id: string
    status: string
    testId: string
    totalScore: number | null
    maxScore: number
    correctCount: number | null
    totalQuestions: number
    level: 'A2' | 'B1' | 'B2' | 'C1' | null
    createdAt: string
  }
  section: {
    id: string
    type: SectionType
    title: string
    audioUrl: string | null
    videoExplanationUrl: string | null
  }
  testTitle: string
  parts: PartDto[]
  questions: QuestionDto[]
  answers: ReviewAnswer[]
}

/** Per-question verdict used by every review component. */
export type Verdict = 'correct' | 'wrong' | 'skipped'

export function verdictOf(answer: ReviewAnswer | undefined): Verdict {
  const answered = Array.isArray(answer?.response)
    ? answer.response.length > 0
    : !!answer?.response
  if (!answered) return 'skipped'
  return answer?.isCorrect ? 'correct' : 'wrong'
}

/** Render a stored response or correctAnswer for display. */
export function formatAnswer(value: unknown): string {
  if (value == null || value === '') return ''
  if (Array.isArray(value)) return value.map(String).join(', ')
  return String(value)
}

/**
 * Accepted answers for a gap fill are stored as an array of alternatives; show
 * them as "one / 1" rather than the comma-joined list used for a multi-select.
 */
export function formatCorrectAnswer(question: QuestionDto): string {
  const correct = question.correctAnswer
  if (question.type === 'text_input' && Array.isArray(correct)) {
    return correct.map(String).join(' / ')
  }
  if (Array.isArray(correct)) {
    return correct.map(v => labelFor(question, String(v))).join(', ')
  }
  return correct == null ? '' : labelFor(question, String(correct))
}

/** Choice questions store option values; students recognise the labels. */
export function labelFor(question: QuestionDto, value: string): string {
  const opt = question.options.find(o => o.value === value)
  if (!opt) return value
  return opt.label === value ? value : `${value}. ${opt.label}`
}
