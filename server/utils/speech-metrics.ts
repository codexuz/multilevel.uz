/**
 * What the speech recognition tells about how an answer was spoken, from its word timings and
 * confidences: words said, speed, pauses, fillers ("um", "er"), and words it could hardly make out.
 * The examiner model reads these with the transcript; pronunciation is judged from the confidences.
 */

export interface HeardWord { word: string, start: number, end: number, confidence: number }

export interface SpeechMetrics {
  /** Words said, fillers left out. */
  words: number
  speakingSeconds: number
  wpm: number
  /** Gaps of a second or more, and of 2.5 seconds or more. */
  pauses: number
  longPauses: number
  fillers: number
  /** Average recognition confidence of the words (0–1): a rough sign of how clearly they were said. */
  avgConfidence: number
  /** Words recognised with low confidence. */
  unclearWords: string[]
}

const FILLERS = new Set(['uh', 'um', 'uhm', 'umm', 'er', 'erm', 'ah', 'eh', 'hmm', 'mm', 'mhm'])
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d

export function speechMetrics(heard: HeardWord[]): SpeechMetrics {
  const isFiller = (w: HeardWord) => FILLERS.has(w.word.toLowerCase().replace(/[^a-z]/g, ''))
  const content = heard.filter(w => !isFiller(w))
  let pauses = 0
  let longPauses = 0
  for (let i = 1; i < heard.length; i++) {
    const gap = heard[i]!.start - heard[i - 1]!.end
    if (gap >= 1) pauses++
    if (gap >= 2.5) longPauses++
  }
  const speakingSeconds = heard.length ? Math.max(0, heard[heard.length - 1]!.end - heard[0]!.start) : 0
  const avgConfidence = content.length ? content.reduce((s, w) => s + w.confidence, 0) / content.length : 0
  const unclear = [...new Set(content.filter(w => w.confidence < 0.6 && w.word.length > 2).map(w => w.word.toLowerCase().replace(/[^\p{L}'-]/gu, '')))].filter(Boolean)
  return {
    words: content.length,
    speakingSeconds: round(speakingSeconds, 1),
    wpm: speakingSeconds > 3 ? Math.round((content.length / speakingSeconds) * 60) : 0,
    pauses,
    longPauses,
    fillers: heard.length - content.length,
    avgConfidence: round(avgConfidence, 3),
    unclearWords: unclear.slice(0, 15)
  }
}
