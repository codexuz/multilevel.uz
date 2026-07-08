import { eq } from 'drizzle-orm'
import { users } from '../../../database/schema'

// Permanently delete a user. Sessions, attempts, answers, subscriptions and
// transactions cascade; authored tests/graded attempts keep null references.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  if (id === admin.id) throw createError({ statusCode: 400, message: 'You cannot delete yourself' })

  const db = useDb()
  await db.delete(users).where(eq(users.id, id))
  return { ok: true }
})
