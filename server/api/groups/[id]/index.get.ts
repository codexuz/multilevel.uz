import { desc, eq } from 'drizzle-orm'
import { assignments } from '../../../database/schema'

// A class for its teacher: its exam type, students and where each stands, and its assignments.
export default defineEventHandler(async (event) => {
  const { group } = await requireClassTeacher(event, String(getRouterParam(event, 'id')))
  const [students, list] = await Promise.all([
    groupStudents(group.id),
    useDb().select().from(assignments).where(eq(assignments.groupId, group.id)).orderBy(desc(assignments.createdAt))
  ])
  const ids = students.map(s => s.id)
  return {
    id: group.id, name: group.name, exam: group.exam, level: group.level, description: group.description, joinCode: group.joinCode, archived: group.archived,
    students,
    assignments: await Promise.all(list.map(a => assignmentView(a, ids)))
  }
})
