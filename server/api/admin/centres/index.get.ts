import { desc, sql } from 'drizzle-orm'
import { centres, users } from '../../../database/schema'

// Every learning centre, with its seats taken, owner, groups and licence. (The subqueries name
// centres.id in full: with no join, a column would be printed bare and mean the inner table's id.)
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const rows = await useDb().select({
    c: centres,
    students: sql<number>`(select count(*)::int from centre_members m where m.centre_id = centres.id and m.role = 'STUDENT')`,
    teachers: sql<number>`(select count(*)::int from centre_members m where m.centre_id = centres.id and m.role in ('OWNER', 'TEACHER'))`,
    groups: sql<number>`(select count(*)::int from class_groups g where g.centre_id = centres.id and not g.archived)`,
    owner: sql<string | null>`(select coalesce(u.name, '@' || u.telegram_username, u.email) from centre_members m join ${users} u on u.id = m.user_id where m.centre_id = centres.id and m.role = 'OWNER' limit 1)`
  }).from(centres).orderBy(desc(centres.createdAt))
  return rows.map(r => ({ ...r.c, students: r.students, teachers: r.teachers, groups: r.groups, owner: r.owner, open: licenceOpen(r.c) }))
})
