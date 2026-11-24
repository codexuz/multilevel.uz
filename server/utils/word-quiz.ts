import { and, asc, eq, ne, notInArray, sql } from 'drizzle-orm'
import { userWords, wordCache } from '../database/schema'

/**
 * Quiz practice on My Words, beside the flashcards:
 * - fill the gap: the student's own saved sentence with the word taken out, and its meaning as the
 *   clue; they type the word as the sentence has it.
 * - pick the meaning: the word, and four definitions to choose from; the wrong ones come from their
 *   other saved words, then from words other students saved (word_cache), the same part of speech
 *   first.
 * Words still being learnt come first; the answers go to the page, which marks them (they are the
 * student's own words), and a wrong one brings the word forward for review (quiz.post.ts).
 */

export const QUIZ_MODES = ['mix', 'gap', 'meaning'] as const
export type QuizMode = typeof QUIZ_MODES[number]
export const isQuizMode = (v: unknown): v is QuizMode => QUIZ_MODES.includes(v as QuizMode)

/** The fewest saved words with a meaning for pick-the-meaning (the answer and three others). */
export const MEANING_CHOICES = 4

type Row = typeof userWords.$inferSelect

export type QuizQuestion
  = | {
    kind: 'gap'
    wordId: string
    /** The sentence around the gap. */
    before: string
    after: string
    /** The words that fill it, as the sentence has them. */
    answer: string
    /** Also right: the word as it was saved, and its dictionary form when it fits the gap the same. */
    accept: string[]
    clue: string | null
    translation: string | null
    partOfSpeech: string | null
  }
  | {
    kind: 'meaning'
    wordId: string
    word: string
    /** The sentence it came from, split around the word as saved ("forgetting", where `word` is "forget"). */
    context: { before: string, answer: string, after: string } | null
    /** Four definitions, in random order; `correct` is the index of the right one. */
    choices: string[]
    correct: number
  }

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The saved words in their sentence, as a gap: null when the sentence does not hold them. */
export function gapOf(sentence: string | null, word: string) {
  if (!sentence || !word) return null
  const m = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRe(word)})(?=$|[^\\p{L}\\p{N}])`, 'iu').exec(sentence)
  if (!m) return null
  const start = m.index + m[1]!.length
  const answer = sentence.slice(start, start + m[2]!.length)
  return { before: sentence.slice(0, start), answer, after: sentence.slice(start + answer.length) }
}

function shuffle<T>(items: T[]) {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/** Three wrong definitions for a word: the student's other words first, then other students'. */
async function distractors(word: Row, mine: Row[]) {
  const same = (r: { partOfSpeech: string | null }) => !!word.partOfSpeech && r.partOfSpeech === word.partOfSpeech
  const differs = (d: string | null | undefined) => !!d && d.trim().toLowerCase() !== word.definition?.trim().toLowerCase()
  const own = shuffle(mine.filter(r => r.id !== word.id && r.lemma !== word.lemma && differs(r.definition)))
  const picked = [...own.filter(same), ...own.filter(r => !same(r))].map(r => r.definition!.trim())
  if (picked.length < MEANING_CHOICES - 1) {
    const taken = new Set([word.term, ...mine.map(r => r.term)])
    const others = await useDb().select({ definition: wordCache.definition, partOfSpeech: wordCache.partOfSpeech })
      .from(wordCache)
      .where(and(notInArray(wordCache.term, [...taken]), ...(word.lemma ? [ne(wordCache.lemma, word.lemma)] : [])))
      .orderBy(sql`(${wordCache.partOfSpeech} is not distinct from ${word.partOfSpeech}) desc`, sql`random()`)
      .limit(18)
    for (const o of others) if (differs(o.definition)) picked.push(o.definition.trim())
  }
  return [...new Set(picked)].slice(0, MEANING_CHOICES - 1)
}

/**
 * A quiz of up to `limit` questions on the student's words: those in the lowest boxes (still being
 * learnt) first, in random order within a box.
 */
export async function buildQuiz(userId: string, mode: QuizMode, limit: number, locale: WordLocale) {
  const db = useDb()
  const pool = await db.select().from(userWords)
    .where(eq(userWords.userId, userId))
    .orderBy(asc(sql`least(${userWords.box}, 3)`), sql`random()`)
    .limit(Math.max(limit * 3, 30))
  // Words without a meaning yet get one first (from the shared cache, or the AI).
  const words = await Promise.all(pool.map(r => (r.definition ? r : defineSavedWord(r, locale))))
  const defined = words.filter(r => r.definition)

  const questions: QuizQuestion[] = []
  for (const w of words) {
    if (questions.length >= limit) break
    const gap = gapOf(w.sentence, w.word)
    const canGap = mode !== 'meaning' && !!gap
    const canMeaning = mode !== 'gap' && !!w.definition
    if (!canGap && !canMeaning) continue
    const kind = canGap && canMeaning ? (Math.random() < 0.5 ? 'gap' : 'meaning') : canGap ? 'gap' : 'meaning'
    if (kind === 'gap') {
      const accept = [w.word]
      // "mitigate" for "mitigate" in the sentence, not for "mitigated".
      if (w.lemma && gap!.answer.toLowerCase() === w.lemma.toLowerCase()) accept.push(w.lemma)
      questions.push({ kind, wordId: w.id, ...gap!, accept: [...new Set(accept)], clue: w.definition, translation: w.translation, partOfSpeech: w.partOfSpeech })
      continue
    }
    const wrong = await distractors(w, defined)
    if (wrong.length < MEANING_CHOICES - 1) {
      // Too few words saved to make up the choices: a gap instead, if the sentence allows one.
      if (gap && mode !== 'meaning') questions.push({ kind: 'gap', wordId: w.id, ...gap, accept: [w.word], clue: w.definition, translation: w.translation, partOfSpeech: w.partOfSpeech })
      continue
    }
    const choices = shuffle([w.definition!.trim(), ...wrong])
    questions.push({
      kind: 'meaning',
      wordId: w.id,
      word: w.lemma && w.lemma !== w.term ? w.lemma : w.word,
      context: gap,
      choices,
      correct: choices.indexOf(w.definition!.trim())
    })
  }
  return { questions, saved: pool.length }
}
