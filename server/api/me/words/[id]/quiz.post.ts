import { and, eq, sql } from 'drizzle-orm'
import { userWords } from '../../../../database/schema'

/**
 * How I did with a word in a quiz. A wrong answer brings it forward: it is due for review now (its
 * box stays; the flashcards decide that). A right one changes nothing.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 404, message: 'No such word' })
  const correct = (await readBody<{ correct?: unknown }>(event))?.correct
  if (typeof correct !== 'boolean') throw createError({ statusCode: 400, message: 'correct: true or false' })

  const now = new Date()
  const [word] = await useDb().update(userWords)
    .set(correct ? { updatedAt: now } : { dueAt: sql`least(${userWords.dueAt}, ${now.toISOString()}::timestamptz)` })
    .where(and(eq(userWords.id, id), eq(userWords.userId, user.id)))
    .returning({ id: userWords.id, dueAt: userWords.dueAt })
  if (!word) throw createError({ statusCode: 404, message: 'No such word' })
  const xpGained = correct ? await awardXpQuietly(user.id, 'words', XP.word) : 0
  return { id: word.id, dueAt: word.dueAt, xpGained }
})
