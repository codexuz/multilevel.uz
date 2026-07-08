import { eq } from 'drizzle-orm'
import { users, sessions } from '../../../../database/schema'
import { publishToUser } from '../../../../utils/events'

// Ban or unban a user. Banning also revokes their refresh sessions and pushes a
// live "banned" event so open tabs get kicked; requireUser blocks them thereafter.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  if (id === admin.id) throw createError({ statusCode: 400, message: 'You cannot ban yourself' })

  const body = await readBody<{ banned?: boolean }>(event)
  const banned = body.banned !== false // default: ban

  const db = useDb()
  await db.update(users).set({ banned, updatedAt: new Date() }).where(eq(users.id, id))

  if (banned) {
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, id))
    await publishToUser(id, { type: 'banned' })
  }
  return { ok: true, banned }
})
