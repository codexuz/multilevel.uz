import { and, eq } from 'drizzle-orm'
import { subscriptions } from '../../../../database/schema'
import { publishToUser } from '../../../../utils/events'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  const db = useDb()
  await db.update(subscriptions)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(and(eq(subscriptions.userId, id), eq(subscriptions.status, 'active')))

  // Live status update so the user's UI reflects the revocation without a reload.
  await publishToUser(id, { type: 'premium', isPremium: false })

  return { ok: true }
})
