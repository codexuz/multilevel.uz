/**
 * Multilevel names and scores. Writing tasks are numbered 1–3 (Task 1.1, Task 1.2, Task 2) and
 * speaking parts 1–4 (Part 1.1, Part 1.2, Part 2, Part 3), so the IELTS structure underneath holds them.
 */
export const WRITING_TASK_LABEL: Record<number, string> = { 1: 'Task 1.1', 2: 'Task 1.2', 3: 'Task 2' }
export const SPEAKING_PART_LABEL: Record<number, string> = { 1: 'Part 1.1', 2: 'Part 1.2', 3: 'Part 2', 4: 'Part 3' }
export const writingTaskLabel = (n?: number | null) => (n ? i18nT('part.task', { n: WRITING_TASK_LABEL[n]?.replace('Task ', '') ?? n }, WRITING_TASK_LABEL[n] ?? `Task ${n}`) : i18nT('part.taskWord', {}, 'Task'))
export const speakingPartLabel = (n?: number | null) => (n ? i18nT('part.part', { n: SPEAKING_PART_LABEL[n]?.replace('Part ', '') ?? n }, SPEAKING_PART_LABEL[n] ?? `Part ${n}`) : i18nT('part.partWord', {}, 'Part'))

/** The usual length and time of each Multilevel writing task. */
export const writingDefaults = (n: number) => (n === 1 ? { minWords: 50, minutes: 15 } : n === 2 ? { minWords: 120, minutes: 20 } : { minWords: 180, minutes: 25 })

/** A scaled score (0–75) as text: "51 / 75", or "—". */
export const fmtScore = (score?: number | null) => (score == null || Number.isNaN(Number(score)) ? '—' : `${Math.round(Number(score))}`)

/** CEFR from a scaled score, as the server reckons it: 65+ C1, 51+ B2, 38+ B1, else below B1. */
export function cefrOf(score?: number | null) {
  if (score == null) return null
  if (score >= 65) return 'C1'
  if (score >= 51) return 'B2'
  if (score >= 38) return 'B1'
  return 'A2'
}

export function scoreColor(score?: number | null): 'success' | 'primary' | 'warning' | 'error' | 'neutral' {
  if (score == null || Number.isNaN(Number(score))) return 'neutral'
  if (score >= 65) return 'success'
  if (score >= 51) return 'primary'
  if (score >= 38) return 'warning'
  return 'error'
}

/** A part's name within its skill: "Part 3", "Task 1.2", "Part 1.1" (Speaking). */
export function partName(skill: string, n?: number | null) {
  if (!n) return ''
  if (skill === 'WRITING') return writingTaskLabel(n)
  if (skill === 'SPEAKING') return speakingPartLabel(n)
  return i18nT('part.part', { n }, `Part ${n}`)
}

/** The part numbers each skill has, as the catalogue offers them. */
export const PART_NUMBERS: Record<string, number[]> = {
  LISTENING: [1, 2, 3, 4, 5, 6],
  READING: [1, 2, 3, 4, 5],
  WRITING: [1, 2, 3],
  SPEAKING: [1, 2, 3, 4]
}
