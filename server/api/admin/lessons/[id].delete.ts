import { eq } from 'drizzle-orm'
import { lessons } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const db = useDb()
  await db.delete(lessons).where(eq(lessons.id, id))
  return { ok: true }
})
