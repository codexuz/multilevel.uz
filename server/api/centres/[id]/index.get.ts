import { and, desc, eq, sql } from 'drizzle-orm'
import { centreMembers, classGroups, users } from '../../../database/schema'

// A centre for its owner and teachers: seats, licence, teachers and groups (the teacher code for the owner).
export default defineEventHandler(async (event) => {
  const { centre, role } = await requireCentreStaff(event, String(getRouterParam(event, 'id')))
  const db = useDb()
  const [students, teachers, groups] = await Promise.all([
    studentsInCentre(centre.id),
    db.select({ id: users.id, name: users.name, telegramUsername: users.telegramUsername, email: users.email, role: centreMembers.role })
      .from(centreMembers).innerJoin(users, eq(users.id, centreMembers.userId))
      .where(and(eq(centreMembers.centreId, centre.id), sql`${centreMembers.role} in ('OWNER', 'TEACHER')`)),
    db.select({
      g: classGroups,
      teacher: users.name,
      students: sql<number>`(select count(*)::int from class_members m where m.group_id = class_groups.id)`,
      assignments: sql<number>`(select count(*)::int from assignments a where a.group_id = class_groups.id)`
    }).from(classGroups).leftJoin(users, eq(users.id, classGroups.teacherId))
      .where(eq(classGroups.centreId, centre.id)).orderBy(classGroups.archived, desc(classGroups.createdAt))
  ])
  return {
    id: centre.id, name: centre.name, role,
    seats: centre.seats, students, licensedUntil: centre.licensedUntil, open: licenceOpen(centre),
    teacherCode: role === 'OWNER' ? centre.teacherCode : null,
    teachers: teachers.map(t => ({ id: t.id, name: t.name || (t.telegramUsername ? `@${t.telegramUsername}` : t.email) || 'Teacher', role: t.role })),
    groups: groups.map(r => ({ id: r.g.id, name: r.g.name, joinCode: r.g.joinCode, archived: r.g.archived, teacher: r.teacher, students: r.students, assignments: r.assignments }))
  }
})
