import { eq } from 'drizzle-orm'
import { parts } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{
    title?: string
    instructions?: string | null
    content?: unknown
    audioUrl?: string | null
    orderIndex?: number
  }>(event)

  const patch: Record<string, unknown> = {}
  if (body.title !== undefined) patch.title = body.title
  if (body.instructions !== undefined) patch.instructions = body.instructions
  if (body.content !== undefined) patch.content = body.content
  if (body.audioUrl !== undefined) patch.audioUrl = body.audioUrl
  if (body.orderIndex !== undefined) patch.orderIndex = body.orderIndex

  const db = useDb()
  await db.update(parts).set(patch).where(eq(parts.id, id))
  return { ok: true }
})
