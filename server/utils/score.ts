// Multilevel raw-correct → scaled-score conversion for the objective skills
// (Listening / "Tinglab tushunish" and Reading / "O'qish"), plus CEFR banding.
// Index into each table = number of correct answers (0..35). Values are the
// official average scaled scores; a variant's difficulty may shift them slightly.

const LISTENING = [
  0, // 0 correct
  23, 26, 28, 30, 33, 34, 36, 38, 39, 41, // 1..10
  42, 44, 45, 47, 48, 50, 51, 53, 54, 55, // 11..20
  57, 58, 60, 61, 63, 65, 66, 68, 70, 72, // 21..30
  73, 74, 75, 75, 75 // 31..35
]

const READING = [
  0, // 0 correct
  20, 24, 27, 29, 32, 34, 36, 38, 39, 41, // 1..10
  42, 44, 45, 46, 48, 49, 51, 52, 54, 55, // 11..20
  57, 58, 60, 61, 63, 65, 66, 68, 70, 71, // 21..30
  73, 74, 75, 75, 75 // 31..35
]

export type ObjectiveSkill = 'listening' | 'reading'
export type CefrLevel = 'A2' | 'B1' | 'B2' | 'C1'

// Scaled 0–75 score for a given number of correct answers. Correct counts
// beyond the 35-question table are clamped to its bounds.
export function scaledScore(skill: ObjectiveSkill, correct: number): number {
  const table = skill === 'listening' ? LISTENING : READING
  const i = Math.max(0, Math.min(Math.round(correct), table.length - 1))
  return table[i]!
}

// CEFR band from a scaled score: 38–50 B1, 51–64 B2, 65–75 C1, below 38 A2.
export function cefrLevel(score: number): CefrLevel {
  if (score >= 65) return 'C1'
  if (score >= 51) return 'B2'
  if (score >= 38) return 'B1'
  return 'A2'
}

/**
 * The scaled score for `correct` right answers, read from the official table as they are: the
 * score is out of the whole 35-question section, so only 35 right answers make 75, and a single
 * part practised on its own scores what those answers are worth in the exam (7 right → 36 in
 * Reading), not its share scaled up. `settings.scale` on a section (36 numbers, index = right
 * answers) replaces the table.
 */
export function sectionScore(skill: ObjectiveSkill, correct: number, settings?: { scale?: unknown } | null): number {
  const custom = Array.isArray(settings?.scale) && settings.scale.length === 36 && settings.scale.every(n => Number.isFinite(Number(n)))
    ? (settings.scale as unknown[]).map(Number)
    : null
  const table = custom ?? (skill === 'listening' ? LISTENING : READING)
  const i = Math.max(0, Math.min(Math.round(correct), table.length - 1))
  return table[i]!
}
