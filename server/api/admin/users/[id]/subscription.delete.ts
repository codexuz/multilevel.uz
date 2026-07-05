import { and, eq } from 'drizzle-orm'
import { subscriptions } from '../../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  const db = useDb()
  await db.update(subscriptions)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(and(eq(subscriptions.userId, id), eq(subscriptions.status, 'active')))
  return { ok: true }
})
