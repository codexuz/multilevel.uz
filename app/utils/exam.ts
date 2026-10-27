import type { IELTSQuestion } from '~/types/ielts'

export function getQuestionRange(question: IELTSQuestion): [number, number] {
  const nums = question.questions?.map(q => q.questionNumber).filter((n): n is number => n != null) ?? []
  if (!nums.length) return [question.questionNumber ?? 0, question.questionNumber ?? 0]
  return [Math.min(...nums), Math.max(...nums)]
}

export function getAllQuestionNumbers(questions: IELTSQuestion[]): number[] {
  const nums: number[] = []
  for (const q of questions) {
    if (q.questions?.length) {
      for (const sub of q.questions) if (sub.questionNumber != null) nums.push(sub.questionNumber)
    } else if (q.questionNumber != null) {
      nums.push(q.questionNumber)
    }
  }
  return nums.sort((a, b) => a - b)
}

export function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// A gap is "___", "{blank}" (numbered in order) or "{7}" (question 7, wherever it stands). Dots are
// not a gap: "he said nothing...." keeps its dots as written.
export const BLANK_PATTERN = /_{2,}\u00A0?|\{blank\}|\{answer\}|\[blank\]|\(\.\.\.\)|\{\d{1,2}\}/gi

/** A line of a gapped text: its pieces of text, with a gap (numbered in `nums`) between each two. */
export interface GapLine { parts: string[], nums: number[] }

/**
 * Hands out the number of each gap of a text, met in reading order: a "{7}" gap is question 7; the
 * plain gaps take the remaining numbers in order. A gap left without a question gets 0.
 */
export function gapNumberer(text: string, nums: number[]) {
  const explicit = new Set([...text.matchAll(/\{(\d{1,2})\}/g)].map(m => Number(m[1])))
  const free = nums.filter(n => !explicit.has(n))
  let idx = 0
  return (gap: string) => {
    const numbered = /^\{(\d{1,2})\}$/.exec(gap)
    return numbered ? Number(numbered[1]) : (free[idx++] ?? 0)
  }
}

const INLINE_TAG = /<(\/?)(strong|b|em|i|u)\b[^>]*>/gi

/**
 * Pieces of HTML cut apart at the gaps, each made whole: a "<strong>" open across a gap is closed
 * before it and opened again after it, so the bold carries on past the input.
 */
function balanceTags(parts: string[]) {
  let open: { name: string, tag: string }[] = []
  return parts.map((part) => {
    const before = open.map(t => t.tag).join('')
    const stack = [...open]
    for (const m of part.matchAll(INLINE_TAG)) {
      const name = m[2]!.toLowerCase()
      if (!m[1]) stack.push({ name, tag: m[0] })
      else for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i]!.name === name) {
          stack.splice(i, 1)
          break
        }
      }
    }
    open = stack
    return before + part + [...stack].reverse().map(t => `</${t.name}>`).join('')
  })
}

/** A line of HTML split at its gaps, each numbered by `numberOf`. */
export function splitGaps(line: string, numberOf: (gap: string) => number): GapLine {
  const re = new RegExp(BLANK_PATTERN.source, 'gi')
  return { parts: balanceTags(line.split(re)), nums: [...line.matchAll(re)].map(m => numberOf(m[0])) }
}

/** A question's own sentence split at its gaps: a plain gap is the question's own, "{n}" is question n. */
export function promptGaps(text: string, n: number): GapLine {
  return splitGaps(text, gap => Number(/^\{(\d{1,2})\}$/.exec(gap)?.[1] ?? n))
}

/** A piece of a gapped text: some HTML, or the gap for question `n` (0 for a gap without a question). */
export type GapPiece = { html: string, n?: undefined } | { n: number, html?: undefined }

const toPieces = (line: GapLine): GapPiece[] => line.parts.flatMap((html, i) => (i ? [{ n: line.nums[i - 1]! }, { html }] : [{ html }]))

/**
 * A summary to fill as lines of text and gaps: the group's text as one line with its gaps where it has
 * any; else each question's sentence on a line of its own, its gap where the sentence has one or at
 * its end.
 */
export function gapPieces(html: string, subs: { questionNumber?: number, questionText?: string }[]): GapPiece[][] {
  const text = html.replace(/<\/p>\s*<p>/gi, '<br/><br/>').replace(/<\/?p>/gi, '')
  const whole = splitGaps(text, gapNumberer(text, subs.map(s => s.questionNumber ?? 0)))
  if (whole.nums.length) return [toPieces(whole)]
  return subs.map((sub) => {
    const line = promptGaps(sub.questionText ?? '', sub.questionNumber ?? 0)
    return line.nums.length ? toPieces(line) : [{ html: line.parts[0] ?? '' }, { n: sub.questionNumber ?? 0 }]
  })
}

/**
 * A table-completion table with each cell cut into lines ("<br>" or a new line breaks one) and the
 * lines split at their gaps, numbered across the table row by row. Only bold, italics and underline
 * are kept of a cell's markup.
 */
export function gapTable(rows: string[][], nums: number[]) {
  const numberOf = gapNumberer(rows.flat().join(' '), nums)
  return rows.map(row => row.map(cell => (cell ?? '')
    .split(/<br\s*\/?>|\n/i)
    .map(line => line.replace(/<\/?(?!(?:strong|b|em|i|u)>)[a-z][^>]*>/gi, '').replace(/&nbsp;/gi, ' ').trim())
    .filter(Boolean)
    .map(line => splitGaps(line, numberOf))))
}

export function partLabel(part?: string) {
  if (!part) return ''
  return part.replace('PART_', 'Part ').replace('TASK_', 'Task ')
}

export function bandColor(band?: number | null): 'success' | 'primary' | 'warning' | 'error' | 'neutral' {
  if (band == null || Number.isNaN(band)) return 'neutral'
  if (band >= 7) return 'success'
  if (band >= 6) return 'primary'
  if (band >= 5) return 'warning'
  return 'error'
}

export function formatDate(value?: string | null, withTime = false) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return localeDate(d, intlLocale(), withTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' })
}

export function stripHtml(html?: string | null) {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

export function countWords(text: string) {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

/**
 * A heading gap for each matching-headings question, placed in the passage just above the paragraph
 * it is about, as the computer-delivered IELTS has it. The paragraph is, in order: the one that starts
 * with the question's own number ("**14** Some workers…"); the one starting with the label its text
 * names ("Paragraph A", "Paragraph 15", or just "A") in bold or as its first word; for a number, that
 * paragraph counting from the top ("Section 2"). A question whose paragraph is not found keeps its gap
 * in the questions.
 */
export function insertHeadingSlots(html: string, questions: IELTSQuestion[]) {
  const subs = questions.filter(q => q.type === 'MATCHING_HEADINGS').flatMap(q => q.questions ?? [])
  if (!subs.length || !html || typeof DOMParser === 'undefined') return html
  const doc = new DOMParser().parseFromString(`<div id="ix-root">${html}</div>`, 'text/html')
  const root = doc.getElementById('ix-root')!
  const paras = [...root.querySelectorAll('p')].filter(p => p.textContent?.trim())
  const lead = (p: HTMLElement) => p.firstElementChild && /^(strong|b)$/i.test(p.firstElementChild.tagName) && p.textContent!.trim().startsWith(p.firstElementChild.textContent!.trim())
    ? p.firstElementChild.textContent!.trim()
    : null
  const startsWith = (label: string) => paras.find(p => lead(p)?.toUpperCase() === label.toUpperCase())
    ?? paras.find(p => new RegExp(`^${label}[\\s.):]`, 'i').test(p.textContent!.trim()))
  for (const sub of subs) {
    const text = (sub.questionText ?? '').trim()
    const label = /(?:paragraph|section|part)\s+([A-Z]|\d+)\b/i.exec(text)?.[1] ?? (/^([A-Z]|\d+)$/i.exec(text)?.[1] ?? '')
    let target: HTMLElement | undefined = sub.questionNumber != null ? startsWith(String(sub.questionNumber)) : undefined
    if (!target && label) target = startsWith(label)
    if (!target && /^\d+$/.test(label)) target = paras[Number(label) - 1]
    if (!target || target.previousElementSibling?.classList.contains('ix-heading-slot')) continue
    const slot = doc.createElement('div')
    slot.className = 'ix-heading-slot'
    slot.id = `heading-slot-${sub.questionNumber}`
    target.before(slot)
  }
  return root.innerHTML
}
