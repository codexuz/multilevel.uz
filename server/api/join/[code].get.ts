import { and, eq } from 'drizzle-orm'
import { centres, classGroups, classMembers } from '../../database/schema'

// What a join link opens: the group and centre, whether there is room, and whether I am in it already.
export default defineEventHandler(async (event) => {
  const code = String(getRouterParam(event, 'code')).trim().toUpperCase()
  const db = useDb()
  const [row] = await db.select({ g: classGroups, c: centres }).from(classGroups).innerJoin(centres, eq(centres.id, classGroups.centreId))
    .where(and(eq(classGroups.joinCode, code), eq(classGroups.archived, false))).limit(1)
  if (!row) throw createError({ statusCode: 404, message: 'No class has that code. Check it with your teacher.' })
  const user = await optionalUser(event)
  const [member] = user ? await db.select({ one: classMembers.userId }).from(classMembers).where(and(eq(classMembers.groupId, row.g.id), eq(classMembers.userId, user.id))).limit(1) : []
  return {
    group: { id: row.g.id, name: row.g.name },
    centre: { name: row.c.name },
    open: licenceOpen(row.c) && (await studentsInCentre(row.c.id)) < row.c.seats,
    member: !!member
  }
})
