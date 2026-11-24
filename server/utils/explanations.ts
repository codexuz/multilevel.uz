import { and, count, eq } from 'drizzle-orm'
import { explanationOpens } from '../database/schema'

/**
 * Answer explanations on marked Listening and Reading results: free, for up to 10 results a day
 * (Tashkent time; EXPLANATIONS_PER_DAY). Opening a result's explanations uses one of the day's; once
 * opened they stay open, so going back to it costs nothing. Admins, markers and a student's teachers
 * see them without using the student's.
 */

const envInt = (name: string, fallback: number) => {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback
}
export const explanationsPerDay = () => envInt('EXPLANATIONS_PER_DAY', 10)

/** The Tashkent day, as YYYY-MM-DD. */
export const tashkentDay = (now = new Date()) => new Date(now.getTime() + 5 * 3_600_000).toISOString().slice(0, 10)

export interface ExplanationAccess {
  open: boolean
  /** Results whose explanations can still be opened today; null without a limit. */
  left: number | null
  limit: number | null
}

/** How many results' explanations this user has opened today, and may still open. */
export async function explanationsToday(userId: string): Promise<{ used: number, left: number, limit: number }> {
  const limit = explanationsPerDay()
  const [row] = await useDb().select({ n: count() }).from(explanationOpens)
    .where(and(eq(explanationOpens.userId, userId), eq(explanationOpens.openedOn, tashkentDay())))
  const used = row?.n ?? 0
  return { used, left: Math.max(0, limit - used), limit }
}

/**
 * Whether the owner of a result sees its explanations, opening them (and using one of today's) the
 * first time when some are left. `free`: the viewer sees them without the owner's allowance.
 */
export async function openExplanations(ownerId: string, attemptId: string, opts: { free?: boolean } = {}): Promise<ExplanationAccess> {
  if (opts.free) return { open: true, left: null, limit: null }
  const db = useDb()
  const [already] = await db.select({ day: explanationOpens.openedOn }).from(explanationOpens)
    .where(and(eq(explanationOpens.userId, ownerId), eq(explanationOpens.attemptId, attemptId))).limit(1)
  const today = await explanationsToday(ownerId)
  if (already) return { open: true, left: today.left, limit: today.limit }
  if (today.left < 1) return { open: false, left: 0, limit: today.limit }
  // Two pages opening it at once count it once.
  const made = await db.insert(explanationOpens).values({ userId: ownerId, attemptId, openedOn: tashkentDay() }).onConflictDoNothing().returning({ day: explanationOpens.openedOn })
  return { open: true, left: made.length ? today.left - 1 : today.left, limit: today.limit }
}

/**
 * A marked section as the result screens show it (reviewSection), with its explanations when the
 * viewer sees them: free for `free` viewers, else from the owner's 10 a day. A section with no
 * explanations uses none. The review says how many are left today (`explanationsLeft`).
 */
export async function explainedReview(section: any, opts: Parameters<typeof reviewSection>[1] & { ownerId: string, attemptId: string, free: boolean }) {
  const { ownerId, attemptId, free, ...rest } = opts
  const hidden = reviewSection(section, { ...rest, explanations: false })
  if (!hidden.locked) return { ...hidden, explanationsLeft: null, explanationsLimit: null }
  const access = await openExplanations(ownerId, attemptId, { free })
  const review = access.open ? reviewSection(section, { ...rest, explanations: true }) : hidden
  return { ...review, explanationsLeft: access.left, explanationsLimit: access.limit }
}
