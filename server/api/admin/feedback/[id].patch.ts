import { eq } from 'drizzle-orm'
import { supportFeedback } from '../../../database/schema'

const STATUSES = new Set(['open', 'in_progress', 'resolved', 'closed'])

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing feedback id' })

  const body = await readBody<{ status?: string, adminNote?: string | null }>(event)
  const nextStatus = body?.status ? String(body.status) : undefined
  if (nextStatus && !STATUSES.has(nextStatus)) {
    throw createError({ statusCode: 400, message: 'Invalid status' })
  }

  const updates: Partial<typeof supportFeedback.$inferInsert> = {
    updatedAt: new Date()
  }
  if (nextStatus) {
    updates.status = nextStatus
    if (nextStatus === 'resolved' || nextStatus === 'closed') {
      updates.resolvedById = admin.id
      updates.resolvedAt = new Date()
    } else {
      updates.resolvedAt = null
    }
  }
  if (body?.adminNote !== undefined) {
    updates.adminNote = body.adminNote ? String(body.adminNote).trim().slice(0, 2000) : null
  }

  const db = useDb()
  const [updated] = await db
    .update(supportFeedback)
    .set(updates)
    .where(eq(supportFeedback.id, id))
    .returning({
      id: supportFeedback.id,
      status: supportFeedback.status,
      adminNote: supportFeedback.adminNote,
      resolvedAt: supportFeedback.resolvedAt
    })

  if (!updated) throw createError({ statusCode: 404, message: 'Feedback item not found' })
  return {
    item: {
      id: updated.id,
      status: updated.status,
      adminNote: updated.adminNote,
      resolvedAt: updated.resolvedAt ? updated.resolvedAt.toISOString() : null
    }
  } as {
    item: {
      id: string
      status: string
      adminNote: string | null
      resolvedAt: string | null
    }
  }
})
