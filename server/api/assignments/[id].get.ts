import { eq } from 'drizzle-orm'
import { assignments } from '../../database/schema'

// Who has done an assignment, with their score and result, for the group's teachers.
export default defineEventHandler(async (event) => {
  const [a] = await useDb().select().from(assignments).where(eq(assignments.id, String(getRouterParam(event, 'id')))).limit(1)
  if (!a) throw createError({ statusCode: 404, message: 'Assignment not found' })
  await requireGroupStaff(event, a.groupId)
  const students = await groupStudents(a.groupId)
  const done = await assignmentHandIns(a, students.map(s => s.id))
  return {
    ...(await assignmentView(a, students.map(s => s.id))),
    students: students.map(s => ({ id: s.id, name: s.name, handIn: done.get(s.id) ?? null }))
      .sort((x, y) => Number(!!y.handIn) - Number(!!x.handIn) || (y.handIn?.score ?? -1) - (x.handIn?.score ?? -1))
  }
})
