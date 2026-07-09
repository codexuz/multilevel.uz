import { eq } from 'drizzle-orm'
import { courseModules } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ title?: string, summary?: string | null, orderIndex?: number }>(event)

  const patch: Record<string, unknown> = {}
  if (body.title !== undefined) patch.title = body.title
  if (body.summary !== undefined) patch.summary = body.summary
  if (body.orderIndex !== undefined) patch.orderIndex = body.orderIndex

  const db = useDb()
  await db.update(courseModules).set(patch).where(eq(courseModules.id, id))
  return { ok: true }
})
