import { and, asc, eq, lte, sql } from 'drizzle-orm'
import { userWords } from '../../../database/schema'

/**
 * The words for a review session: those due now, the longest waiting first (new words after the
 * ones already being learnt). With ?ahead=1 and nothing due, the ones due soonest instead, to
 * practise ahead. A word still without a meaning gets one first (?locale= for its translation).
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const limit = Math.min(50, Math.max(1, Math.floor(Number(query.limit) || 20)))
  const locale = isWordLocale(query.locale) ? query.locale : 'en'
  const db = useDb()
  const now = new Date()

  let rows = await db.select().from(userWords)
    .where(and(eq(userWords.userId, user.id), lte(userWords.dueAt, now)))
    .orderBy(asc(sql`${userWords.box} = 0`), asc(userWords.dueAt))
    .limit(limit)
  const ahead = !rows.length && query.ahead === '1'
  if (ahead) {
    rows = await db.select().from(userWords).where(eq(userWords.userId, user.id)).orderBy(asc(userWords.dueAt)).limit(limit)
  }

  const words = await Promise.all(rows.map(r => defineSavedWord(r, locale)))
  return { items: words.map(wordView), ahead }
})
