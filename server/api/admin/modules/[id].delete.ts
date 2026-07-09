import { eq } from 'drizzle-orm'
import { courseModules } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const db = useDb()
  await db.delete(courseModules).where(eq(courseModules.id, id))
  return { ok: true }
})
