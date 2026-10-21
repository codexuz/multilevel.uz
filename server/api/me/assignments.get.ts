import { desc, eq, inArray } from 'drizzle-orm'
import { assignments, classGroups, classMembers } from '../../database/schema'

// The work my groups set me: newest first, with whether I have done each (and my result).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = useDb()
  const groups = await db.select({ id: classGroups.id, name: classGroups.name }).from(classMembers)
    .innerJoin(classGroups, eq(classGroups.id, classMembers.groupId)).where(eq(classMembers.userId, user.id))
  if (!groups.length) return { groups: [], items: [] }
  const list = await db.select().from(assignments).where(inArray(assignments.groupId, groups.map(g => g.id))).orderBy(desc(assignments.createdAt)).limit(30)
  const items = await Promise.all(list.map(async (a) => {
    const view = await assignmentView(a, [user.id])
    const mine = (await assignmentHandIns(a, [user.id])).get(user.id) ?? null
    return { ...view, group: groups.find(g => g.id === a.groupId)?.name ?? '', mine }
  }))
  return { groups, items }
})
