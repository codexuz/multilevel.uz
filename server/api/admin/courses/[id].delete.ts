import { eq } from 'drizzle-orm'
import { courses } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const db = useDb()
  await db.delete(courses).where(eq(courses.id, id))
  return { ok: true }
})
