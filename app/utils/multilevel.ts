/**
 * Exam names and scores. Multilevel writing tasks are numbered 1–3 (Task 1.1, Task 1.2, Task 2) and
 * speaking parts 1–4 (Part 1.1, Part 1.2, Part 2, Part 3); IELTS has Task 1 and 2 and Parts 1–3. A
 * label takes the exam it is for (Multilevel when not said).
 */
const WRITING_TASK_LABEL: Record<number, string> = { 1: 'Task 1.1', 2: 'Task 1.2', 3: 'Task 2' }
const SPEAKING_PART_LABEL: Record<number, string> = { 1: 'Part 1.1', 2: 'Part 1.2', 3: 'Part 2', 4: 'Part 3' }
export function writingTaskLabel(n?: number | null, exam?: string | null) {
  if (!n) return i18nT('part.taskWord', {}, 'Task')
  if (exam === 'IELTS') return i18nT('part.task', { n }, `Task ${n}`)
  return i18nT('part.task', { n: WRITING_TASK_LABEL[n]?.replace('Task ', '') ?? n }, WRITING_TASK_LABEL[n] ?? `Task ${n}`)
}
export function speakingPartLabel(n?: number | null, exam?: string | null) {
  if (!n) return i18nT('part.partWord', {}, 'Part')
  if (exam === 'IELTS') return i18nT('part.part', { n }, `Part ${n}`)
  return i18nT('part.part', { n: SPEAKING_PART_LABEL[n]?.replace('Part ', '') ?? n }, SPEAKING_PART_LABEL[n] ?? `Part ${n}`)
}

/** The usual length and time of a writing task. */
export const writingDefaults = (n: number, exam?: string | null) => writingTaskDefaults(exam, n)

/** A scaled score (0–75) as text: "51", or "—". */
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

/** A result on its own exam's scale. */
export interface ExamResult { exam?: string | null, score?: number | null, band?: number | null }

/** A result as its exam writes it: "6.5" (an IELTS band) or "51" (a Multilevel score); "—" before it is marked. */
export const fmtResult = (r: ExamResult) => (r.exam === 'IELTS' || r.band != null ? fmtBand(r.band) : fmtScore(r.score))
/** What a result is out of: "/ 75" for a Multilevel score; nothing for an IELTS band, which is read as it is. */
export const resultScale = (r: ExamResult) => (r.exam === 'IELTS' || r.band != null ? '' : '/ 75')
export const resultColor = (r: ExamResult) => (r.exam === 'IELTS' || r.band != null ? bandColor(r.band) : scoreColor(r.score))
/** Whether there is a mark to show yet. */
export const hasResult = (r: ExamResult) => r.band != null || r.score != null

/** A part's name within its skill: "Part 3", "Task 1.2", "Part 1.1" (Speaking). */
export function partName(skill: string, n?: number | null, exam?: string | null) {
  if (!n) return ''
  if (skill === 'WRITING') return writingTaskLabel(n, exam)
  if (skill === 'SPEAKING') return speakingPartLabel(n, exam)
  return i18nT('part.part', { n }, `Part ${n}`)
}

/** The part numbers each skill has, as the catalogue offers them (Multilevel). */
export const PART_NUMBERS: Record<string, number[]> = {
  LISTENING: [1, 2, 3, 4, 5, 6],
  READING: [1, 2, 3, 4, 5],
  WRITING: [1, 2, 3],
  SPEAKING: [1, 2, 3, 4]
}
/** The part numbers a skill has in an exam. */
export const partNumbers = (skill: string, exam?: string | null) => partNumbersOf(exam ?? 'MULTILEVEL', skill)

/** An exam's name: "IELTS Academic", "IELTS General Training", "Multilevel". */
export function examLabel(exam?: string | null, module?: string | null) {
  if (module === 'ACADEMIC') return i18nT('exam.academic', {}, 'IELTS Academic')
  if (module === 'GENERAL_TRAINING') return i18nT('exam.general', {}, 'IELTS General Training')
  return exam === 'IELTS' ? 'IELTS' : 'Multilevel'
}

/** A result for a chip: "6.5" (with the word Band) or "51/75"; null before it is marked. */
export function resultChip(r: ExamResult, withBand = true) {
  if (r.band != null) return `${withBand ? `${i18nT('result.band', {}, 'Band')} ` : ''}${fmtBand(r.band)}`
  if (r.score != null) return `${fmtScore(r.score)}/75`
  return null
}
/** The CEFR level of a result, from the level stored with it or its score or band. */
export const resultLevel = (r: ExamResult & { cefrLevel?: string | null }) => r.cefrLevel ?? (r.band != null ? bandCefr(r.band) : cefrOf(r.score))
