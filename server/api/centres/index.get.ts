import { and, asc, eq, sql } from 'drizzle-orm'
import { centres } from '../../database/schema'

// The public catalogue: centres that chose to be listed and whose licence runs, with their contacts.
export default defineEventHandler(async () => {
  const rows = await useDb().select({
    c: centres,
    students: sql<number>`(select count(*)::int from centre_members m where m.centre_id = centres.id and m.role = 'STUDENT')`
  }).from(centres)
    .where(and(eq(centres.listed, true), eq(centres.active, true), sql`${centres.licensedUntil} > now()`))
    .orderBy(asc(centres.name))
  return rows.map(r => ({ id: r.c.id, name: r.c.name, students: r.students, ...listingView(r.c) }))
})
