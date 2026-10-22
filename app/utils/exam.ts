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
