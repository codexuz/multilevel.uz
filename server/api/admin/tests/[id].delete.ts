import { eq } from 'drizzle-orm'
import { tests } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const db = useDb()
  await db.delete(tests).where(eq(tests.id, id)) // cascades sections/parts/questions
  return { ok: true }
})
