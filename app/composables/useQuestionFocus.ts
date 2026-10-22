import type { InjectionKey, Ref } from 'vue'

/**
 * Which question is in hand — boxed in blue on the question and in the bottom bar, as in the
 * computer-delivered IELTS — and how a question says it was entered (a gap focused, a choice made).
 */
export interface QuestionFocus {
  current: Ref<number | null | undefined>
  focus: (n: number) => void
}

export const QUESTION_FOCUS: InjectionKey<QuestionFocus> = Symbol('question-focus')

export function useQuestionFocus() {
  const ctx = inject(QUESTION_FOCUS, null)
  return {
    isCurrent: (n: number) => !!ctx && ctx.current.value === n,
    focus: (n: number) => ctx?.focus(n)
  }
}
