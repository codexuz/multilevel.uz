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

export const BLANK_PATTERN = /_{3,}|\.{3,}|\{blank\}|\{answer\}|\[blank\]|\(\.\.\.\)|\{\d{1,2}\}/gi

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
