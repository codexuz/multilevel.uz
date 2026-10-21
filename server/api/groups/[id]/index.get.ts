import { desc, eq } from 'drizzle-orm'
import { assignments, centres } from '../../../database/schema'

// A group for its centre's teachers: its students and where each stands, and its assignments with how many did each.
export default defineEventHandler(async (event) => {
  const { group, role } = await requireGroupStaff(event, String(getRouterParam(event, 'id')))
  const db = useDb()
  const [students, list, [centre]] = await Promise.all([
    groupStudents(group.id),
    db.select().from(assignments).where(eq(assignments.groupId, group.id)).orderBy(desc(assignments.createdAt)),
    db.select({ id: centres.id, name: centres.name }).from(centres).where(eq(centres.id, group.centreId)).limit(1)
  ])
  const ids = students.map(s => s.id)
  return {
    id: group.id, name: group.name, joinCode: group.joinCode, archived: group.archived, role,
    centre,
    students,
    assignments: await Promise.all(list.map(a => assignmentView(a, ids)))
  }
})
