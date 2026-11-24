/**
 * The review schedule of My Words (a Leitner schedule), shared by the server, which keeps it, and
 * the review page, which shows when each answer brings a word back.
 */

export const GRADES = ['again', 'hard', 'good'] as const
export type Grade = typeof GRADES[number]
export const isGrade = (v: unknown): v is Grade => GRADES.includes(v as Grade)

/** The highest box: a word there is known, and comes back about once a month. */
export const TOP_WORD_BOX = 5
/** Days until a word in each box comes back (box 0 is new: never reviewed). */
const BOX_DAYS = [0, 1, 2, 4, 7, 15] as const
/** Days until a word answered Hard comes back, by its box: about half the usual wait. */
const HARD_DAYS = [0, 0.5, 1, 2, 4, 8] as const
/** A known word answered Good again. */
const KNOWN_DAYS = 30
/** A word answered Again comes back this soon (the review page asks it again before then). */
export const AGAIN_MINUTES = 10

const DAY = 86_400_000

/**
 * Where a word goes after a review: Good moves it up a box and it comes back later (1, 2, 4, 7,
 * 15 days, then 30 once known); Hard keeps it in its box and brings it back sooner; Again sends it
 * back to the first box, to be asked again in a few minutes.
 */
export function scheduleReview(box: number, grade: Grade, now = new Date()) {
  const from = Math.min(Math.max(0, Math.floor(box)), TOP_WORD_BOX)
  if (grade === 'again') {
    return { box: 1, dueAt: new Date(now.getTime() + AGAIN_MINUTES * 60_000), lapse: from > 1, days: 0 }
  }
  if (grade === 'hard') {
    const stay = Math.max(1, from)
    const days = HARD_DAYS[stay]!
    return { box: stay, dueAt: new Date(now.getTime() + Math.round(days * DAY)), lapse: false, days }
  }
  const up = Math.min(from + 1, TOP_WORD_BOX)
  const days = from === TOP_WORD_BOX ? KNOWN_DAYS : BOX_DAYS[up]!
  return { box: up, dueAt: new Date(now.getTime() + days * DAY), lapse: false, days }
}
