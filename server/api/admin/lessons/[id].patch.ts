import { eq } from 'drizzle-orm'
import { lessons } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{
    title?: string
    type?: 'video' | 'article' | 'quiz'
    content?: string | null
    videoUrl?: string | null
    attachments?: { label: string, url: string }[]
    durationMinutes?: number
    isPreview?: boolean
    orderIndex?: number
  }>(event)

  const patch: Record<string, unknown> = {}
  if (body.title !== undefined) patch.title = body.title
  if (body.type !== undefined) patch.type = body.type
  if (body.content !== undefined) patch.content = body.content
  if (body.videoUrl !== undefined) patch.videoUrl = body.videoUrl
  if (body.attachments !== undefined) patch.attachments = body.attachments
  if (body.durationMinutes !== undefined) patch.durationMinutes = body.durationMinutes
  if (body.isPreview !== undefined) patch.isPreview = body.isPreview
  if (body.orderIndex !== undefined) patch.orderIndex = body.orderIndex

  const db = useDb()
  await db.update(lessons).set(patch).where(eq(lessons.id, id))
  return { ok: true }
})
