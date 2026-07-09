import { eq } from 'drizzle-orm'
import { courses } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{
    title?: string
    description?: string | null
    level?: string | null
    category?: string | null
    thumbnailUrl?: string | null
    estimatedMinutes?: number | null
    isPremium?: boolean
    status?: 'draft' | 'published'
    orderIndex?: number
  }>(event)

  const patch: Record<string, unknown> = { updatedAt: new Date() }
  if (body.title !== undefined) patch.title = body.title
  if (body.description !== undefined) patch.description = body.description
  if (body.level !== undefined) patch.level = body.level
  if (body.category !== undefined) patch.category = body.category
  if (body.thumbnailUrl !== undefined) patch.thumbnailUrl = body.thumbnailUrl
  if (body.estimatedMinutes !== undefined) patch.estimatedMinutes = body.estimatedMinutes
  if (body.isPremium !== undefined) patch.isPremium = body.isPremium
  if (body.status !== undefined) patch.status = body.status
  if (body.orderIndex !== undefined) patch.orderIndex = body.orderIndex

  const db = useDb()
  await db.update(courses).set(patch).where(eq(courses.id, id))
  return { ok: true }
})
