import { eq } from 'drizzle-orm'
import { users } from '../../../../database/schema'

// Switch marking on or off for a user: a marker marks Writing and Speaking of students outside a centre.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  const marker = (await readBody<{ marker?: boolean }>(event))?.marker !== false
  const [row] = await useDb().update(users).set({ marker, updatedAt: new Date() }).where(eq(users.id, id)).returning({ id: users.id })
  if (!row) throw createError({ statusCode: 404, message: 'User not found' })
  return { ok: true, marker }
})
