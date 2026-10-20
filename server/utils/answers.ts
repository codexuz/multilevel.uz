// Ported unchanged from erp-lms (apps/api/src/addons/ielts/scoring/answers.ts): the same marking for the same keys.
/**
 * Marking Listening and Reading answers the way an IELTS marker does: spelling must be right, but
 * case, spacing, stray punctuation, hyphens and whether a number is written in digits or words do
 * not matter; alternatives in a key are separated by "/" ("colour/color") and words in brackets
 * are optional ("(the) river bank"); and "choose TWO letters" earns a mark for each right letter,
 * in any order.
 */

export type AnswerKind = 'CHOICE' | 'MULTI' | 'TEXT' | 'TFNG' | 'YNNG'

/** The task types the builder offers, and how each is marked. */
export const IELTS_QUESTION_TYPES: Record<string, AnswerKind> = {
  MULTIPLE_CHOICE: 'CHOICE',
  MULTIPLE_ANSWER: 'MULTI',
  TRUE_FALSE_NOT_GIVEN: 'TFNG',
  YES_NO_NOT_GIVEN: 'YNNG',
  MATCHING_HEADINGS: 'CHOICE',
  MATCHING_INFORMATION: 'CHOICE',
  MATCHING_FEATURES: 'CHOICE',
  MATCHING_SENTENCE_ENDINGS: 'CHOICE',
  PLAN_MAP_LABELLING: 'CHOICE',
  SUMMARY_COMPLETION_DRAG_DROP: 'CHOICE',
  NOTE_COMPLETION: 'TEXT',
  TABLE_COMPLETION: 'TEXT',
  FLOW_CHART_COMPLETION: 'TEXT',
  SUMMARY_COMPLETION: 'TEXT',
  SENTENCE_COMPLETION: 'TEXT',
  DIAGRAM_LABELLING: 'TEXT',
  SHORT_ANSWER: 'TEXT'
}

export const kindOf = (type: string | null | undefined): AnswerKind => IELTS_QUESTION_TYPES[type ?? ''] ?? 'TEXT'

const UNITS: Record<string, number> = {
  zero: 0, nought: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19
}
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }

/** "twenty five" → "25", "fifteen" → "15", word by word; everything else is left alone. */
function numberWordsToDigits(tokens: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!
    if (token in TENS) {
      const next = tokens[i + 1]
      if (next && next in UNITS && UNITS[next]! > 0 && UNITS[next]! < 10) {
        out.push(String(TENS[token]! + UNITS[next]!))
        i++
      } else out.push(String(TENS[token]))
    } else if (token in UNITS) out.push(String(UNITS[token]))
    else out.push(token)
  }
  return out
}

/** The comparable form of an answer or a key. */
export function normaliseAnswer(value: string): string {
  let text = String(value ?? '').normalize('NFKC').toLowerCase()
  // Answers typed into the passage editor can carry markup and entities.
  text = text.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  text = text.replace(/[‘’ʼ`]/g, '\'').replace(/[“”]/g, '"')
  // A thousands separator is not part of the number: 1,500 and 1500 are the same answer.
  text = text.replace(/(\d),(?=\d{3}\b)/g, '$1')
  // 10 a.m., 10 am and 10am; 25 per cent and 25%.
  text = text.replace(/\b([ap])\.\s?m\b\.?/g, '$1m').replace(/(\d)\s+(am|pm)\b/g, '$1$2')
  text = text.replace(/\s*\bper\s?cent\b/g, '%')
  // Hyphens and dashes join words the way a space does.
  text = text.replace(/[-‐-―]/g, ' ')
  // Punctuation is dropped, except inside a number (3.5, 7:30, 12/05).
  text = text.replace(/[.,;:!?/]/g, (mark, offset: number, whole: string) => (/\d/.test(whole[offset - 1] ?? '') && /\d/.test(whole[offset + 1] ?? '') ? mark : ' '))
  text = text.replace(/["()[\]{}]/g, ' ')
  return numberWordsToDigits(text.split(/\s+/).filter(Boolean)).join(' ')
}

/**
 * The alternatives a key allows. "/" separates them — except between two digits, where it is part
 * of a date or a fraction (12/05, 3/4), which the old marker wrongly split in two.
 */
export function splitKey(key: string | null | undefined): string[] {
  if (!key) return []
  const parts: string[] = []
  let current = ''
  const text = String(key)
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '/' && !(/\d/.test(text[i - 1] ?? '') && /\d/.test(text[i + 1] ?? ''))) {
      parts.push(current)
      current = ''
    } else current += char
  }
  parts.push(current)
  return parts.map(part => part.trim()).filter(Boolean)
}

/** "(the) river bank" is both "the river bank" and "river bank". At most 4 optional parts. */
export function expandKey(key: string): string[] {
  const parts = String(key).split(/(\([^)]*\))/).filter(part => part !== '')
  const optional = parts.filter(part => /^\(.*\)$/.test(part)).length
  if (optional === 0 || optional > 4) return [key]
  let variants = ['']
  for (const part of parts) {
    if (/^\(.*\)$/.test(part)) {
      const inner = part.slice(1, -1)
      variants = variants.flatMap(variant => [variant + inner, variant])
    } else variants = variants.map(variant => variant + part)
  }
  return variants
}

const JUDGEMENTS: Record<'TFNG' | 'YNNG', Record<string, string>> = {
  TFNG: { 't': 'true', 'true': 'true', 'f': 'false', 'false': 'false', 'ng': 'not given', 'not given': 'not given', 'notgiven': 'not given' },
  YNNG: { 'y': 'yes', 'yes': 'yes', 'n': 'no', 'no': 'no', 'ng': 'not given', 'not given': 'not given', 'notgiven': 'not given' }
}

function canonical(kind: AnswerKind, value: string): string {
  const text = normaliseAnswer(value)
  if (kind === 'TFNG' || kind === 'YNNG') return JUDGEMENTS[kind][text] ?? text
  return text
}

/** Accepted answers as a list: stored as one already, or (from the old system) as one "/"-separated key. */
export const alternativesOf = (key: string | string[] | null | undefined): string[] =>
  (Array.isArray(key)
    ? key.map(entry => String(entry ?? '').trim()).filter(Boolean)
    : splitKey(String(key ?? '').replace(/<[^>]*>/g, ' ')))

/** One answer against its key. Null when the question has no key to mark against. */
export function isAnswerCorrect(type: string | null | undefined, key: string | string[] | null | undefined, answer: string | null | undefined): boolean | null {
  const alternatives = alternativesOf(key)
  if (!alternatives.length) return null
  if (answer == null || !String(answer).trim()) return false
  const kind = kindOf(type)
  const given = canonical(kind, answer)
  if (!given) return false
  const variants = kind === 'TEXT' ? alternatives.flatMap(expandKey) : alternatives
  return variants.some(variant => canonical(kind, variant) === given)
}

/**
 * "Choose TWO letters" (questions 21–22, keys B and D) marked as a set: each right letter earns one
 * mark whichever box it was typed in, and a letter given twice earns it once. Returns, in the order
 * given, whether each item earns its mark.
 */
export function markAsSet(items: Array<{ key: string | string[] | null | undefined, answer: string | null | undefined }>): boolean[] {
  const picked = new Set(items.map(item => item.answer).filter(answer => answer && String(answer).trim()).map(answer => canonical('MULTI', answer!)))
  const keys = items.map(item => alternativesOf(item.key).map(key => canonical('MULTI', key)))
  // Each key is claimed at most once; a question whose own key was picked keeps its mark.
  return keys.map((alternatives) => {
    const hit = alternatives.find(key => picked.has(key))
    if (hit) picked.delete(hit)
    return !!hit
  })
}
