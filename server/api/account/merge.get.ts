import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'

// What merging would bring in: the other account, for the signed-in account the token was made for.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const otherId = accountToMerge(String(getQuery(event).token ?? ''), user.id)
  if (!otherId) throw createError({ statusCode: 403, message: 'This link has expired or was made for a different account. Start again from the account you want to keep.' })
  const db = useDb()
  const [[keep], [other]] = await Promise.all([
    db.select().from(users).where(eq(users.id, user.id)).limit(1),
    db.select().from(users).where(eq(users.id, otherId)).limit(1)
  ])
  if (!keep || !other) throw createError({ statusCode: 404, message: 'That account no longer exists' })
  return { other: await mergePreview(otherId), conflict: mergeConflict(keep, other) }
})
