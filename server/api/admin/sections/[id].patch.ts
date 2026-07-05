import { eq } from 'drizzle-orm'
import { sections } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{
    title?: string
    durationMinutes?: number
    audioUrl?: string | null
    orderIndex?: number
  }>(event)

  const patch: Record<string, unknown> = {}
  if (body.title !== undefined) patch.title = body.title
  if (body.durationMinutes !== undefined) patch.durationMinutes = body.durationMinutes
  if (body.audioUrl !== undefined) patch.audioUrl = body.audioUrl
  if (body.orderIndex !== undefined) patch.orderIndex = body.orderIndex

  const db = useDb()
  await db.update(sections).set(patch).where(eq(sections.id, id))
  return { ok: true }
})
