import { eq, sql } from 'drizzle-orm'
import { userWords } from '../../../database/schema'

/** How My Words stands: how many there are, how many are due now, and how they are getting on. */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const now = new Date()
  // Raw SQL takes the instants as text: the driver does not serialise a Date there.
  const at = now.toISOString()
  const today = tashkentDayStart(now).toISOString()
  const [row] = await useDb().select({
    total: sql<number>`count(*)::int`,
    due: sql<number>`count(*) filter (where ${userWords.dueAt} <= ${at}::timestamptz)::int`,
    fresh: sql<number>`count(*) filter (where ${userWords.box} = 0)::int`,
    learning: sql<number>`count(*) filter (where ${userWords.box} between 1 and ${TOP_WORD_BOX - 1})::int`,
    known: sql<number>`count(*) filter (where ${userWords.box} >= ${TOP_WORD_BOX})::int`,
    reviewedToday: sql<number>`count(*) filter (where ${userWords.lastReviewedAt} >= ${today}::timestamptz)::int`,
    nextDueAt: sql<string | null>`min(${userWords.dueAt}) filter (where ${userWords.dueAt} > ${at}::timestamptz)`
  }).from(userWords).where(eq(userWords.userId, user.id))
  return {
    total: row?.total ?? 0,
    due: row?.due ?? 0,
    new: row?.fresh ?? 0,
    learning: row?.learning ?? 0,
    known: row?.known ?? 0,
    reviewedToday: row?.reviewedToday ?? 0,
    nextDueAt: row?.nextDueAt ? new Date(row.nextDueAt).toISOString() : null
  }
})
