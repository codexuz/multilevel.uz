import { eq } from 'drizzle-orm'
import { sections } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const db = useDb()
  await db.delete(sections).where(eq(sections.id, id))
  return { ok: true }
})
