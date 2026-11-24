import { and, eq, sql } from 'drizzle-orm'
import { userWords } from '../../../../database/schema'

/** How I did with a word in review (again, hard or good): when it comes back next. */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 404, message: 'No such word' })
  const grade = (await readBody<{ grade?: unknown }>(event))?.grade
  if (!isGrade(grade)) throw createError({ statusCode: 400, message: `grade: ${GRADES.join(', ')}` })

  const db = useDb()
  const [word] = await db.select({ box: userWords.box }).from(userWords)
    .where(and(eq(userWords.id, id), eq(userWords.userId, user.id))).limit(1)
  if (!word) throw createError({ statusCode: 404, message: 'No such word' })

  const now = new Date()
  const next = scheduleReview(word.box, grade, now)
  const [updated] = await db.update(userWords).set({
    box: next.box,
    dueAt: next.dueAt,
    reviews: sql`${userWords.reviews} + 1`,
    lapses: next.lapse ? sql`${userWords.lapses} + 1` : userWords.lapses,
    lastReviewedAt: now
  }).where(and(eq(userWords.id, id), eq(userWords.userId, user.id))).returning()
  if (!updated) throw createError({ statusCode: 404, message: 'No such word' })
  return { word: wordView(updated) }
})
