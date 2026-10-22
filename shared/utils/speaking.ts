/**
 * Speaking as the real exam runs it, one turn at a time. Each turn has its time to prepare and its
 * time to speak; a part's own times (from the builder) replace the official ones.
 *
 * Multilevel: Part 1.1 and Part 1.2 question by question, Part 2 and Part 3 in one long turn each.
 * Official times (seconds): Part 1.1 5 + 30 per question; Part 1.2 10 + 45 for the first question
 * (the pictures), then 5 + 30; Part 2 and Part 3 60 + 120.
 * IELTS: Part 1 and Part 3 question by question (the examiner asks, the candidate answers at once:
 * 3 + 30 and 3 + 60), Part 2 the cue card in one turn (a minute to prepare, two to speak).
 */

export interface SpeakingStepPart {
  id: string
  partNumber: number
  /** IELTS | MULTILEVEL (Multilevel when not said). */
  exam?: string | null
  prepSeconds?: number | null
  speakSeconds?: number | null
  questions?: (string | { text: string })[] | null
}

export interface SpeakingStep {
  partId: string
  partNumber: number
  /** The question's place in its part, from 0; 0 for a part answered in one turn. */
  position: number
  /** The question asked, or null for a cue card or a statement. */
  question: string | null
  prepSeconds: number
  speakSeconds: number
  /** The first turn of its part: the part is introduced before it. */
  first: boolean
}

const textOf = (q: string | { text: string }) => (typeof q === 'string' ? q : q.text).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

/** Multilevel Parts 1.1 and 1.2, and IELTS Parts 1 and 3, are answered question by question. */
export const answeredByQuestion = (partNumber: number, exam?: string | null) =>
  exam === 'IELTS' ? partNumber === 1 || partNumber === 3 : partNumber === 1 || partNumber === 2

export function speakingSteps(parts: SpeakingStepPart[]): SpeakingStep[] {
  const steps: SpeakingStep[] = []
  for (const part of [...parts].sort((a, b) => a.partNumber - b.partNumber)) {
    const questions = (part.questions ?? []).map(textOf).filter(Boolean)
    if (part.exam === 'IELTS') {
      if (answeredByQuestion(part.partNumber, 'IELTS') && questions.length) {
        questions.forEach((question, position) => steps.push({
          partId: part.id, partNumber: part.partNumber, position, question, first: position === 0,
          prepSeconds: part.prepSeconds ?? 3, speakSeconds: part.speakSeconds ?? (part.partNumber === 3 ? 60 : 30)
        }))
      } else {
        steps.push({
          partId: part.id, partNumber: part.partNumber, position: 0, question: part.partNumber === 2 ? null : questions[0] ?? null, first: true,
          prepSeconds: part.prepSeconds ?? 60, speakSeconds: part.speakSeconds ?? 120
        })
      }
      continue
    }
    if (answeredByQuestion(part.partNumber) && questions.length) {
      questions.forEach((question, position) => {
        // Part 1.2 opens with the pictures: longer to look and to describe.
        const opening = part.partNumber === 2 && position === 0
        steps.push({
          partId: part.id, partNumber: part.partNumber, position, question, first: position === 0,
          prepSeconds: opening ? part.prepSeconds ?? 10 : part.partNumber === 1 ? part.prepSeconds ?? 5 : 5,
          speakSeconds: opening ? part.speakSeconds ?? 45 : part.partNumber === 1 ? part.speakSeconds ?? 30 : 30
        })
      })
    } else {
      steps.push({
        partId: part.id, partNumber: part.partNumber, position: 0, question: questions[0] ?? null, first: true,
        prepSeconds: part.prepSeconds ?? 60, speakSeconds: part.speakSeconds ?? 120
      })
    }
  }
  return steps
}

/** How much each part counts toward the Speaking score: 1.1 20%, 1.2 25%, Part 2 25%, Part 3 30%. */
export const SPEAKING_WEIGHTS: Record<number, number> = { 1: 0.2, 2: 0.25, 3: 0.25, 4: 0.3 }
/** IELTS: the three parts count alike (the examiner rates the whole test). */
export const IELTS_SPEAKING_WEIGHTS: Record<number, number> = { 1: 1 / 3, 2: 1 / 3, 3: 1 / 3 }
