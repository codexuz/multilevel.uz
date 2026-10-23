import { and, eq } from 'drizzle-orm'
import { centreMembers, centres } from '../../database/schema'

// Joins a centre as a teacher with the code its owner shared. A student there becomes a teacher (freeing the seat), and
// their account a teacher's.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const code = String((await readBody<{ code?: string }>(event))?.code ?? '').trim().toUpperCase()
  const db = useDb()
  const [c] = code ? await db.select().from(centres).where(eq(centres.teacherCode, code)).limit(1) : []
  if (!c || !c.active) throw createError({ statusCode: 404, message: 'No centre has that teacher code' })
  const [m] = await db.select({ role: centreMembers.role }).from(centreMembers).where(and(eq(centreMembers.centreId, c.id), eq(centreMembers.userId, user.id))).limit(1)
  if (!m) await db.insert(centreMembers).values({ centreId: c.id, userId: user.id, role: 'TEACHER' })
  else if (m.role === 'STUDENT') await db.update(centreMembers).set({ role: 'TEACHER' }).where(and(eq(centreMembers.centreId, c.id), eq(centreMembers.userId, user.id)))
  await raiseRole(db, user.id, 'teacher')
  return { id: c.id, name: c.name }
})
