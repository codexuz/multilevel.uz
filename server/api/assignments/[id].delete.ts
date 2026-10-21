import { eq } from 'drizzle-orm'
import { assignments } from '../../database/schema'

// Removes an assignment (the students' attempts stay theirs).
export default defineEventHandler(async (event) => {
  const [a] = await useDb().select().from(assignments).where(eq(assignments.id, String(getRouterParam(event, 'id')))).limit(1)
  if (!a) throw createError({ statusCode: 404, message: 'Assignment not found' })
  await requireGroupStaff(event, a.groupId)
  await useDb().delete(assignments).where(eq(assignments.id, a.id))
  return { ok: true }
})
