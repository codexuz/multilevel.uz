import { and, eq } from 'drizzle-orm'
import { sessions } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'id required' })

  const db = useDb()
  await db.update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, id), eq(sessions.userId, user.id)))

  return { ok: true }
})
