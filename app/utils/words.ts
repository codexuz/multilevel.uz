/** A word or phrase saved to My Words, as /api/me/words gives it. */
export interface SavedWord {
  id: string
  word: string
  term: string
  lemma: string | null
  sentence: string | null
  partId: string | null
  partOfSpeech: string | null
  definition: string | null
  translation: string | null
  cefr: string | null
  box: number
  dueAt: string
  createdAt: string
}

const MAX_WORDS = 5
const MAX_CHARS = 60
const BLOCK = 'p, li, td, th, dd, dt, h1, h2, h3, h4, h5, h6, blockquote, label'

/**
 * The words selected in a text and the sentence around them, for saving to My Words; null when the
 * selection is not a word or a short phrase (nothing, a number, a whole paragraph).
 */
export function selectedWord(range: Range | null): { word: string, sentence: string } | null {
  if (!range || range.collapsed) return null
  const word = range.toString().replace(/\s+/g, ' ').trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
  if (!word || !/\p{L}/u.test(word) || word.length > MAX_CHARS || word.split(' ').length > MAX_WORDS) return null

  const start = range.startContainer
  const el = start.nodeType === Node.ELEMENT_NODE ? start as Element : start.parentElement
  const block = el?.closest(BLOCK) ?? el
  if (!block) return { word, sentence: '' }
  const text = block.textContent ?? ''
  // Where the selection starts in the block's text.
  let at: number
  try {
    const before = document.createRange()
    before.setStart(block, 0)
    before.setEnd(range.startContainer, range.startOffset)
    at = before.toString().length
  } catch {
    at = Math.max(0, text.indexOf(range.toString()))
  }
  const ends = /[.!?…](?=["'”’)\]]?\s)/g
  let from = 0
  let to = text.length
  for (let m = ends.exec(text); m; m = ends.exec(text)) {
    const end = m.index + 1
    if (end <= at) from = end
    else if (end >= at + word.length) {
      to = end
      break
    }
  }
  // A paragraph's letter ("A Most people assume…") is not part of its first sentence.
  const sentence = text.slice(from, to).replace(/\s+/g, ' ').trim().replace(/^[A-H]\s+(?=[A-Z])/, '')
  return { word, sentence: sentence.length > 400 ? `${sentence.slice(0, 397)}…` : sentence }
}

/** Says a word aloud with the browser's English voice (British, where there is one). */
export function speakWord(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false
  const say = new SpeechSynthesisUtterance(text)
  const voices = window.speechSynthesis.getVoices()
  say.voice = voices.find(v => v.lang === 'en-GB') ?? voices.find(v => v.lang.startsWith('en')) ?? null
  say.lang = say.voice?.lang ?? 'en-GB'
  say.rate = 0.9
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(say)
  return true
}

/** The sentence with the saved words in it set apart, as [before, words, after]. */
export function splitSentence(sentence: string, word: string): [string, string, string] {
  const i = sentence.toLowerCase().indexOf(word.toLowerCase())
  if (i < 0) return [sentence, '', '']
  return [sentence.slice(0, i), sentence.slice(i, i + word.length), sentence.slice(i + word.length)]
}
