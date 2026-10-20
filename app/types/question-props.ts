import type { IELTSQuestion } from './ielts'
import type { AnswerMap } from './exam'

export interface QuestionProps {
  question: IELTSQuestion
  answers: AnswerMap
  disabled?: boolean
  showResults?: boolean
}

export type QuestionEmits = {
  answer: [questionNumber: number, value: string]
}
