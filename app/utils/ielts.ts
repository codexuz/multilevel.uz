import type { AttemptStatus, AttemptSummary, Skill } from '~/types/ielts'

/** 6.5 → "6.5", 7 → "7.0", nothing → "—". */
export const fmtBand = (band?: number | null) => (band == null || Number.isNaN(Number(band)) ? '—' : Number(band).toFixed(1))

export const ATTEMPT_STATUS: Record<AttemptStatus, { label: string, color: 'info' | 'warning' | 'success' | 'neutral' }> = {
  IN_PROGRESS: { label: 'In progress', color: 'info' },
  SUBMITTED: { label: 'Awaiting marking', color: 'warning' },
  AWAITING_CREDIT: { label: 'Not sent for marking', color: 'neutral' },
  GRADED: { label: 'Marked', color: 'success' },
  ABANDONED: { label: 'Abandoned', color: 'neutral' }
}

export const skillLabel = (skill?: string | null) => (skill ? i18nT(`skill.${skill}`, {}, SKILL_META[skill as Skill]?.label ?? skill) : i18nT('skill.FULL', {}, 'Full test'))

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
  // Browsers without Uzbek data write "35 min", so Uzbek is written out ("35 daq.", "1 soat").
  const unit = (n: number, u: 'minute' | 'hour') => appLocale() === 'uz'
    ? `${n} ${u === 'minute' ? 'daq.' : 'soat'}`
    : new Intl.NumberFormat(intlLocale(), { style: 'unit', unit: u, unitDisplay: 'short' }).format(n)
  return m < 60 ? unit(m, 'minute') : `${unit(Math.floor(m / 60), 'hour')} ${unit(m % 60, 'minute')}`
}

const UZ_RELATIVE = {
  format(n: number, unit: 'second' | 'minute' | 'hour' | 'day') {
    const ago = Math.abs(n)
    if (unit === 'second') return 'hozir'
    if (unit === 'day' && ago === 1) return 'kecha'
    return `${ago} ${{ minute: 'daqiqa', hour: 'soat', day: 'kun' }[unit]} oldin`
  }
}

export function relativeTime(value?: string | null) {
  if (!value) return ''
  const diff = (Date.now() - new Date(value).getTime()) / 1000
  // Browsers without Uzbek data write "-3 d", so Uzbek is written out ("3 kun oldin", "kecha").
  const rtf = appLocale() === 'uz' ? UZ_RELATIVE : new Intl.RelativeTimeFormat(intlLocale(), { numeric: 'auto', style: 'short' })
  if (diff < 60) return rtf.format(0, 'second')
  if (diff < 3600) return rtf.format(-Math.floor(diff / 60), 'minute')
  if (diff < 86400) return rtf.format(-Math.floor(diff / 3600), 'hour')
  if (diff < 7 * 86400) return rtf.format(-Math.floor(diff / 86400), 'day')
  return formatDate(value)
}
