import { and, eq, inArray } from 'drizzle-orm'
import { centres, users } from '../../../database/schema'

// Deletes a learning centre: its members (students lose its Premium), groups, assignments, mock
// sessions and credits go with it, and the walk-ins' accounts of its sessions. Results stay with the
// students who sat them.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = String(getRouterParam(event, 'id'))
  const db = useDb()
  const [c] = await db.select({ id: centres.id }).from(centres).where(eq(centres.id, id)).limit(1)
  if (!c) throw createError({ statusCode: 404, message: 'Centre not found' })
  const walkIns = await walkInsOfCentre(id)
  await db.transaction(async (tx) => {
    await tx.delete(centres).where(eq(centres.id, id))
    if (walkIns.length) await tx.delete(users).where(and(inArray(users.id, walkIns), eq(users.mockOnly, true)))
  })
  return { deleted: true }
})
