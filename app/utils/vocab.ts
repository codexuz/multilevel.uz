/** A vocabulary card as a teacher writes it (and as the AI drafts it). */
export interface VocabCardInput {
  term: string
  partOfSpeech?: string | null
  ipa?: string | null
  definition: string
  example?: string | null
  translationUz?: string | null
  translationRu?: string | null
}
export interface VocabCard extends VocabCardInput { id: string, position: number }
export interface VocabDeck {
  id: string
  title: string
  description: string | null
  category: string | null
  topic: string | null
  level: string | null
  updatedAt: string
}
export const VOCAB_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
