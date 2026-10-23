/**
 * Speaking parts as they come in from a file or the builder: each question a string or
 * { text, audioUrl, sampleAnswer }, and the part's own examiner audio and sample answer for a long
 * turn (a cue card or a statement). Imported audio is played as it is, so the examiner's voice is
 * not generated for it; sample answers stand in for the model answers the AI review would write.
 */

export const SPEAKING_FILE_FORMAT = 'mockmee/speaking-parts'

export interface SpeakingQuestionIn { text: string, audioRef: string | null, sampleAnswer: string | null }

const MAX_QUESTION = 1000
const MAX_SAMPLE = 6000

const textOf = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** An audio address: http(s), or a data: URI to be stored; anything else is refused. */
export function audioRefOf(v: unknown, where: string): string | null {
  const ref = textOf(v)
  if (!ref) return null
  if (/^https?:\/\/\S+$/i.test(ref) || ref.startsWith('data:audio/')) return ref
  throw createError({ statusCode: 400, message: `${where}: the audio must be an http(s) address or an embedded audio file` })
}

export function sampleOf(v: unknown, where: string): string | null {
  const sample = textOf(v)
  if (sample && sample.length > MAX_SAMPLE) throw createError({ statusCode: 400, message: `${where}: a sample answer is at most ${MAX_SAMPLE} characters` })
  return sample
}

/** One question: "text", or { text | question, audioUrl | audioRef | audio, sampleAnswer | sample | modelAnswer }. */
export function questionOf(q: unknown, where: string): SpeakingQuestionIn | null {
  const o = (typeof q === 'string' ? { text: q } : q && typeof q === 'object' ? q : {}) as Record<string, unknown>
  const text = textOf(o.text ?? o.question)
  if (!text) return null
  if (text.length > MAX_QUESTION) throw createError({ statusCode: 400, message: `${where}: a question is at most ${MAX_QUESTION} characters` })
  return {
    text,
    audioRef: audioRefOf(o.audioRef ?? o.audioUrl ?? o.audio, where),
    sampleAnswer: sampleOf(o.sampleAnswer ?? o.sample ?? o.modelAnswer, where)
  }
}

export const speakingQuestionsOf = (list: unknown, where: string) =>
  (Array.isArray(list) ? list : []).map((q, i) => questionOf(q, `${where}, question ${i + 1}`)).filter((q): q is SpeakingQuestionIn => !!q)

/** The part's own audio and sample (a long turn), under any of the names a file may use. */
export const partExtrasOf = (p: Record<string, unknown>, where: string) => ({
  audioRef: audioRefOf(p.audioRef ?? p.audioUrl ?? p.audio, where),
  sampleAnswer: sampleOf(p.sampleAnswer ?? p.sample ?? p.modelAnswer, where)
})

/** Embedded audio (data: URIs) stored, the rest kept as it is. */
export async function storeSpeakingAudio<T extends { audioRef: string | null }>(item: T, name: string): Promise<T> {
  return item.audioRef?.startsWith('data:') ? { ...item, audioRef: await keepEmbedded(item.audioRef, name) } : item
}

/** A question as a file writes it: a plain string when it has nothing else (as erp-lms reads it). */
export const questionOut = (q: { text: string, audioRef?: string | null, sampleAnswer?: string | null }) =>
  q.audioRef || q.sampleAnswer ? { text: q.text, audioUrl: q.audioRef ?? null, sampleAnswer: q.sampleAnswer ?? null } : q.text
