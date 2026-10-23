/**
 * Exam integrity, at a mock session's seats only (practice and live mocks are left alone): the exam
 * page notes what it sees while a section is sat (leaving the page, leaving full screen, pasting),
 * sends it to the invigilator's board as it goes, and with the hand-in. Here those notes, and a
 * section finished implausibly fast with a high score, become flags the invigilator sees. Nobody is
 * blocked or marked down by the machine.
 */

export interface IntegritySignals {
  /** Times the page was left (another tab or app), and for how long in all. */
  away: number
  awaySeconds: number
  fullscreenExits: number
  /** Pastes into an answer box, and how many characters they brought in. */
  pastes: number
  pastedChars: number
}

export type Flag = 'AWAY' | 'PASTE' | 'FAST'

/** What makes a flag: limits kept together so they can be read and tuned. */
const LIMIT = {
  awayTimes: 3,
  awaySeconds: 60,
  pastedChars: 200,
  /** Listening or Reading at this share right or more… */
  fastShare: 0.8,
  /** …in fewer seconds than this a question (and at least ten questions). */
  fastSecondsPerQuestion: 15
}

const count = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)))

/** The page's notes, as numbers it could have seen (anything else is dropped). */
export function cleanSignals(raw: unknown): IntegritySignals | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  return {
    away: count(r.away, 1000),
    awaySeconds: count(r.awaySeconds, 86_400),
    fullscreenExits: count(r.fullscreenExits, 1000),
    pastes: count(r.pastes, 1000),
    pastedChars: count(r.pastedChars, 1_000_000)
  }
}

/** The flags for what the page saw, so far or at the hand-in (`marked` and `seconds` once handed in). */
export function flagsOf(skill: string, signals: IntegritySignals | null, done?: { seconds: number | null, marked: { correct: number, total: number } | null }): Flag[] {
  const flags: Flag[] = []
  if (signals && (signals.away >= LIMIT.awayTimes || signals.awaySeconds >= LIMIT.awaySeconds)) flags.push('AWAY')
  if (signals && skill === 'WRITING' && signals.pastedChars >= LIMIT.pastedChars) flags.push('PASTE')
  const m = done?.marked
  if (done?.seconds != null && m && m.total >= 10 && m.correct / m.total >= LIMIT.fastShare && done.seconds < m.total * LIMIT.fastSecondsPerQuestion) flags.push('FAST')
  return flags
}

/** What a seat's attempt stores: the page's notes and the time taken, and its flags. */
export function integrityValues(skill: string, signals: IntegritySignals | null, done: { seconds: number | null, marked: { correct: number, total: number } | null }) {
  const flags = flagsOf(skill, signals, done)
  return {
    integrity: { ...(signals ?? {}), seconds: done.seconds },
    integrityFlags: flags.length ? flags : null,
    integrityStatus: flags.length ? 'FLAGGED' : null
  }
}
