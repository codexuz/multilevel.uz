import { and, eq } from 'drizzle-orm'
import { centreRequests } from '../../../../../database/schema'

// Turns a waiting request down, and tells the one who sent it.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const [row] = await useDb().update(centreRequests).set({ status: 'REJECTED', reviewedById: admin.id, reviewedAt: new Date() })
    .where(and(eq(centreRequests.id, String(getRouterParam(event, 'id'))), eq(centreRequests.status, 'PENDING'))).returning()
  if (!row) throw createError({ statusCode: 404, message: 'No waiting request with that id' })
  await notifyTelegram(row.userId, l => ({ text: MSG.centreRejected(l, row.name) })).catch(() => false)
  return { ok: true }
})
