import { eq } from 'drizzle-orm'
import { parts } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const db = useDb()
  await db.delete(parts).where(eq(parts.id, id))
  return { ok: true }
})
