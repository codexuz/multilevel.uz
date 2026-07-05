import { eq } from 'drizzle-orm'
import { users } from '../../../../database/schema'

const ROLES = ['student', 'examiner', 'admin'] as const

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ role?: string }>(event)
  if (!ROLES.includes(body.role as never)) {
    throw createError({ statusCode: 400, message: 'Invalid role' })
  }

  const db = useDb()
  await db.update(users).set({ role: body.role as never, updatedAt: new Date() }).where(eq(users.id, id))
  return { ok: true }
})
