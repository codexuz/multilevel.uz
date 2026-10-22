/**
 * The two exams Mockmee prepares for, and what differs between them: how many parts and questions
 * each section has, how long it takes, how tasks and parts are numbered, and how a result is scored.
 *
 * Multilevel (the Uzbek national CEFR exam): Listening 6 parts / 35 questions, Reading 5 / 35,
 * Writing Task 1.1, 1.2 and 2, Speaking Part 1.1, 1.2, 2 and 3; each skill scored 0–75.
 * IELTS (Academic or General Training): Listening 4 parts / 40 questions, Reading 3 passages / 40,
 * Writing Task 1 and 2, Speaking Part 1, 2 and 3; each skill a band from 0 to 9 in halves.
 */

export const EXAMS = ['IELTS', 'MULTILEVEL'] as const
export type Exam = (typeof EXAMS)[number]
export const isExam = (value: unknown): value is Exam => EXAMS.includes(value as Exam)

/** An IELTS test is Academic or General Training; a Multilevel test is just that. */
export const IELTS_MODULES = ['ACADEMIC', 'GENERAL_TRAINING'] as const
export const isIeltsModule = (value: unknown): value is (typeof IELTS_MODULES)[number] => IELTS_MODULES.includes(value as (typeof IELTS_MODULES)[number])

/** The exam a test's module belongs to. */
export const examOfModule = (module?: string | null): Exam => (isIeltsModule(module) ? 'IELTS' : 'MULTILEVEL')

type SkillName = 'LISTENING' | 'READING' | 'WRITING' | 'SPEAKING'

export interface ExamFormat {
  LISTENING: { parts: number, questions: number }
  READING: { parts: number, questions: number }
  /** The task numbers Writing has. */
  WRITING: { tasks: number[] }
  /** The part numbers Speaking has. */
  SPEAKING: { parts: number[] }
  /** The official time of each section, in seconds. */
  seconds: Record<SkillName, number>
}

export const EXAM_FORMAT: Record<Exam, ExamFormat> = {
  MULTILEVEL: {
    LISTENING: { parts: 6, questions: 35 },
    READING: { parts: 5, questions: 35 },
    WRITING: { tasks: [1, 2, 3] },
    SPEAKING: { parts: [1, 2, 3, 4] },
    seconds: { LISTENING: 35 * 60, READING: 60 * 60, WRITING: 60 * 60, SPEAKING: 15 * 60 }
  },
  IELTS: {
    LISTENING: { parts: 4, questions: 40 },
    READING: { parts: 3, questions: 40 },
    WRITING: { tasks: [1, 2] },
    SPEAKING: { parts: [1, 2, 3] },
    // Listening: about 30 minutes of recording and 2 minutes to check, as on computer.
    seconds: { LISTENING: 32 * 60, READING: 60 * 60, WRITING: 60 * 60, SPEAKING: 14 * 60 }
  }
}

export const formatOf = (exam?: string | null) => EXAM_FORMAT[isExam(exam) ? exam : 'MULTILEVEL']

/** The part (or task) numbers a skill has in an exam, for pickers and checks. */
export function partNumbersOf(exam: string | null | undefined, skill: string): number[] {
  const f = formatOf(exam)
  if (skill === 'WRITING') return f.WRITING.tasks
  if (skill === 'SPEAKING') return f.SPEAKING.parts
  const n = skill === 'READING' ? f.READING.parts : f.LISTENING.parts
  return Array.from({ length: n }, (_, i) => i + 1)
}

/** The usual length and time of a writing task. */
export function writingTaskDefaults(exam: string | null | undefined, taskNumber: number) {
  if (exam === 'IELTS') return taskNumber === 1 ? { minWords: 150, minutes: 20 } : { minWords: 250, minutes: 40 }
  return taskNumber === 1 ? { minWords: 50, minutes: 15 } : taskNumber === 2 ? { minWords: 120, minutes: 20 } : { minWords: 180, minutes: 25 }
}

/** A writing task's or speaking part's name as candidates know it, in English. */
export function taskName(exam: string | null | undefined, taskNumber: number) {
  if (exam === 'IELTS') return `Task ${taskNumber}`
  return ({ 1: 'Task 1.1', 2: 'Task 1.2', 3: 'Task 2' } as Record<number, string>)[taskNumber] ?? `Task ${taskNumber}`
}
export function speakingPartName(exam: string | null | undefined, partNumber: number) {
  if (exam === 'IELTS') return `Part ${partNumber}`
  return ({ 1: 'Part 1.1', 2: 'Part 1.2', 3: 'Part 2', 4: 'Part 3' } as Record<number, string>)[partNumber] ?? `Part ${partNumber}`
}

// ─── IELTS bands ─────────────────────────────────────────────────────────────────────────────
// Raw scores out of 40 to bands, as IELTS converts them. Listening, Academic Reading and General
// Training Reading each have their own table. Each row is [lowest raw score, band].

type BandTable = ReadonlyArray<readonly [number, number]>

export const LISTENING_BANDS: BandTable = [
  [39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5],
  [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [3, 2], [2, 1.5], [1, 1], [0, 0]
]
export const ACADEMIC_READING_BANDS: BandTable = [
  [39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5],
  [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [3, 2], [2, 1.5], [1, 1], [0, 0]
]
export const GENERAL_READING_BANDS: BandTable = [
  [40, 9], [39, 8.5], [37, 8], [36, 7.5], [34, 7], [32, 6.5], [30, 6], [27, 5.5], [23, 5],
  [19, 4.5], [15, 4], [12, 3.5], [9, 3], [6, 2.5], [4, 2], [2, 1.5], [1, 1], [0, 0]
]

/**
 * The band for `correct` right answers out of `total`. A paper of 40 questions reads the table as it
 * is; a shorter one (an incomplete test) is scaled to 40 first, so it is an estimate.
 */
export function rawToBand(skill: 'LISTENING' | 'READING', module: string | null | undefined, correct: number, total = 40) {
  const table = skill === 'LISTENING' ? LISTENING_BANDS : module === 'GENERAL_TRAINING' ? GENERAL_READING_BANDS : ACADEMIC_READING_BANDS
  const raw = total > 0 && total !== 40 ? Math.round((correct / total) * 40) : correct
  const r = Math.max(0, Math.min(40, Math.round(raw)))
  return table.find(([min]) => r >= min)![1]
}

/** IELTS half-band rounding: .25 goes up to .5, .75 up to the next band (6.25 → 6.5, 6.75 → 7). */
export const roundToHalfBand = (value: number) => Math.floor(value * 2 + 0.5 + 1e-9) / 2

/** The overall band: the mean of the four skills, half-band rounded; null until all four exist. */
export function overallBand(bands: Array<number | null | undefined>) {
  if (bands.length !== 4 || bands.some(b => b == null)) return null
  return roundToHalfBand((bands as number[]).reduce((s, b) => s + b, 0) / 4)
}

/** A band from 0 to 9 in halves. */
export const isBand = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 9 && Number.isInteger(value * 2)

/** The CEFR level a band stands for, as IELTS maps them (B1 4–5, B2 5.5–6.5, C1 7–8, C2 8.5+). */
export function bandCefr(band: number | null | undefined) {
  if (band == null) return null
  if (band >= 8.5) return 'C2'
  if (band >= 7) return 'C1'
  if (band >= 5.5) return 'B2'
  if (band >= 4) return 'B1'
  return 'A2'
}
