import type { AttemptStatus, AttemptSummary, Skill } from '~/types/ielts'

/** 6.5 → "6.5", 7 → "7.0", nothing → "—". */
export const fmtBand = (band?: number | null) => (band == null || Number.isNaN(Number(band)) ? '—' : Number(band).toFixed(1))

export const ATTEMPT_STATUS: Record<AttemptStatus, { label: string, color: 'info' | 'warning' | 'success' | 'neutral' }> = {
  IN_PROGRESS: { label: 'In progress', color: 'info' },
  SUBMITTED: { label: 'Awaiting marking', color: 'warning' },
  GRADED: { label: 'Marked', color: 'success' },
  ABANDONED: { label: 'Abandoned', color: 'neutral' }
}

export const skillLabel = (skill?: string | null) => (skill ? SKILL_META[skill as Skill]?.label ?? skill : 'Full test')

/** What an attempt covered, in words: "Full test", "Reading", "Listening Part 2", "Writing Task 1". */
export function attemptScopeLabel(a: Pick<AttemptSummary, 'scope' | 'skill' | 'part' | 'writingTask'>) {
  if (a.scope === 'TEST') return 'Full test'
  if (a.scope === 'SECTION') return skillLabel(a.skill)
  if (a.scope === 'PART' && a.part) return `${skillLabel(a.part.skill)} Part ${a.part.partNumber}`
  if (a.scope === 'TASK' && a.writingTask) return `Writing Task ${a.writingTask.taskNumber}`
  return skillLabel(a.skill)
}

export function minutesText(seconds?: number | null) {
  if (!seconds) return '—'
  const m = Math.round(seconds / 60)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`
}

export function relativeTime(value?: string | null) {
  if (!value) return ''
  const diff = (Date.now() - new Date(value).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} d ago`
  return formatDate(value)
}
