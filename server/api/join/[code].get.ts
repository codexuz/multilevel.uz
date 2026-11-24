import { and, eq } from 'drizzle-orm'
import { classGroups, classMembers, users } from '../../database/schema'

// What a join link opens: the class and its teacher, and whether I am in it already (or teach it).
export default defineEventHandler(async (event) => {
  const code = String(getRouterParam(event, 'code')).trim().toUpperCase()
  const db = useDb()
  const [row] = await db.select({ g: classGroups, teacher: users.name, handle: users.telegramUsername }).from(classGroups)
    .innerJoin(users, eq(users.id, classGroups.teacherId))
    .where(and(eq(classGroups.joinCode, code), eq(classGroups.archived, false))).limit(1)
  if (!row) throw createError({ statusCode: 404, message: 'No class has that code. Check it with your teacher.' })
  const user = await optionalUser(event)
  const [member] = user ? await db.select({ one: classMembers.userId }).from(classMembers).where(and(eq(classMembers.groupId, row.g.id), eq(classMembers.userId, user.id))).limit(1) : []
  return {
    group: { id: row.g.id, name: row.g.name },
    // The teacher's name (never their email).
    teacher: row.teacher || (row.handle ? `@${row.handle}` : null),
    member: !!member,
    mine: !!user && user.id === row.g.teacherId
  }
})
