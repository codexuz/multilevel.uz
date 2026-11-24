import { and, eq } from 'drizzle-orm'
import { userWords } from '../../../database/schema'

// Takes a word off My Words.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 404, message: 'No such word' })
  const [gone] = await useDb().delete(userWords).where(and(eq(userWords.id, id), eq(userWords.userId, user.id))).returning({ id: userWords.id })
  if (!gone) throw createError({ statusCode: 404, message: 'No such word' })
  return { id: gone.id }
})
