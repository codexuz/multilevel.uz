/**
 * Turning the examiner model's marks into a 0–75 Speaking score. The model gives each criterion a
 * CEFR sub-level (it is far steadier at "a solid B2" than at inventing numbers); each sub-level has
 * its points on the 0–75 scale, set so that the same sub-level throughout lands in its official band
 * (B1 38–50, B2 51–64, C1 65–75). A part's points are the average of its five criteria, and the
 * parts are weighted (1.1 20%, 1.2 25%, Part 2 25%, Part 3 30%).
 *
 * One rule does not depend on the model: an answer far shorter than the time allowed cannot score
 * high on fluency or task achievement, whatever the words were.
 */

export const LEVELS = ['none', 'A1', 'A2', 'B1-', 'B1', 'B1+', 'B2-', 'B2', 'B2+', 'C1-', 'C1', 'C1+', 'C2'] as const
export type SubLevel = typeof LEVELS[number]

export const LEVEL_POINTS: Record<SubLevel, number> = {
  'none': 0, 'A1': 14, 'A2': 27, 'B1-': 38, 'B1': 44, 'B1+': 49, 'B2-': 52, 'B2': 58, 'B2+': 63, 'C1-': 66, 'C1': 71, 'C1+': 75, 'C2': 75
}

/** IELTS: the band each sub-level stands for (B1 4–5, B2 5.5–6.5, C1 7–8, C2 8.5+). */
export const LEVEL_BAND: Record<SubLevel, number> = {
  'none': 0, 'A1': 2, 'A2': 3, 'B1-': 4, 'B1': 4.5, 'B1+': 5, 'B2-': 5.5, 'B2': 6, 'B2+': 6.5, 'C1-': 7, 'C1': 7.5, 'C1+': 8, 'C2': 9
}

export const SPEAKING_CRITERIA = ['fluency', 'vocabulary', 'grammar', 'pronunciation', 'taskAchievement'] as const
export type SpeakingCriterion = typeof SPEAKING_CRITERIA[number]

const rank = (l: SubLevel) => LEVELS.indexOf(l)
const lower = (a: SubLevel, b: SubLevel) => (rank(a) <= rank(b) ? a : b)

/** The highest a part can reach for how much was said in the time allowed (about 100 words a minute is a full answer). */
export function lengthCap(words: number, allowedSeconds: number): SubLevel {
  if (words === 0) return 'none'
  const ratio = words / ((allowedSeconds / 60) * 100)
  if (ratio < 0.15) return 'A1'
  if (ratio < 0.3) return 'A2'
  if (ratio < 0.5) return 'B1'
  if (ratio < 0.7) return 'B2'
  return 'C2'
}

/** One part: the model's sub-levels with the length rule applied, and the part's points. */
export function scorePart(raw: Partial<Record<SpeakingCriterion, string>> | null, words: number, allowedSeconds: number) {
  const labels = {} as Record<SpeakingCriterion, SubLevel>
  for (const c of SPEAKING_CRITERIA) {
    let l: SubLevel = raw && (LEVELS as readonly string[]).includes(raw[c] ?? '') ? raw[c] as SubLevel : 'none'
    if (words === 0) l = 'none'
    else if (c === 'fluency' || c === 'taskAchievement') l = lower(l, lengthCap(words, allowedSeconds))
    labels[c] = l
  }
  const points = SPEAKING_CRITERIA.reduce((s, c) => s + LEVEL_POINTS[labels[c]], 0) / SPEAKING_CRITERIA.length
  return { labels, points: Math.round(points * 10) / 10 }
}

/** The section's score from the parts answered, their weights shared out among them. */
export function speakingScore(parts: { partNumber: number, points: number }[]) {
  const weights = parts.map(p => SPEAKING_WEIGHTS[p.partNumber] ?? 0.25)
  const total = weights.reduce((a, b) => a + b, 0) || 1
  return Math.round(parts.reduce((s, p, i) => s + p.points * weights[i]!, 0) / total)
}

/** A sub-level as a mark out of 5, in halves (the scale the feedback screens and weak spots use). */
export const outOfFive = (l: SubLevel) => Math.round((LEVEL_POINTS[l] / 15) * 2) / 2

/**
 * IELTS: a part's four criteria as whole bands (Fluency and Coherence reads the model's fluency and
 * how fully the questions were answered together), and the part's band, their mean half-band rounded.
 */
export function ieltsPartBands(labels: Record<SpeakingCriterion, SubLevel>) {
  const whole = (n: number) => Math.min(9, Math.max(0, Math.round(n)))
  const criteria = {
    fluency: whole((LEVEL_BAND[labels.fluency] + LEVEL_BAND[labels.taskAchievement]) / 2),
    vocabulary: whole(LEVEL_BAND[labels.vocabulary]),
    grammar: whole(LEVEL_BAND[labels.grammar]),
    pronunciation: whole(LEVEL_BAND[labels.pronunciation])
  }
  return { criteria, band: roundToHalfBand((criteria.fluency + criteria.vocabulary + criteria.grammar + criteria.pronunciation) / 4) }
}
