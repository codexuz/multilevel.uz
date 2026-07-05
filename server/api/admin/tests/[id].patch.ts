import { eq } from 'drizzle-orm'
import { tests } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{
    title?: string
    description?: string | null
    level?: string | null
    isPremium?: boolean
    status?: 'draft' | 'published'
  }>(event)

  const patch: Record<string, unknown> = { updatedAt: new Date() }
  if (body.title !== undefined) patch.title = body.title
  if (body.description !== undefined) patch.description = body.description
  if (body.level !== undefined) patch.level = body.level
  if (body.isPremium !== undefined) patch.isPremium = body.isPremium
  if (body.status !== undefined) patch.status = body.status

  const db = useDb()
  await db.update(tests).set(patch).where(eq(tests.id, id))
  return { ok: true }
})
