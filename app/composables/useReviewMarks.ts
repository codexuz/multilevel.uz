import type { InjectionKey, Ref } from 'vue'

/**
 * The marks on a paper being reviewed, for the test's own question components to draw: each answer
 * green or red as the server marked it, and — while the key is shown — the right answer beside a
 * wrong one and the right choice outlined.
 */
export interface ReviewMarks {
  /** Whether question n earned its mark. */
  correct: (n: number) => boolean
  /** The accepted answers to question n. */
  keys: (n: number) => string[]
  showKey: Ref<boolean>
}

export const REVIEW_MARKS: InjectionKey<ReviewMarks> = Symbol('review-marks')

const norm = (v?: string | null) => judgement(v)

export function useReviewMarks() {
  const marks = inject(REVIEW_MARKS, null)
  return {
    marks,
    /** Whether a choice is one of the accepted answers to question n. */
    isKey: (n: number, value?: string | null) => !!marks && !!value && marks.keys(n).some(k => norm(k) === norm(value)),
    /** The accepted answers, shown beside a wrong one while the key is on. */
    keyFor: (n: number) => (marks && marks.showKey.value && !marks.correct(n) ? marks.keys(n) : []),
    /** A gap or a drop on the marked paper. */
    gapState: (n: number) => (marks ? (marks.correct(n) ? 'is-correct' : 'is-wrong') : '')
  }
}

/** A part (or a writing task) in the review's bottom bar. */
export interface ReviewNavPart {
  id: string
  label: string
  /** Question numbers with whether each earned its mark; none for a writing task. */
  questions?: { n: number, correct: boolean, answered: boolean }[]
  /** A writing task: marked (green) or not yet. */
  done?: boolean
  count?: string
}
