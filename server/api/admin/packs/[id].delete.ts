import { and, eq } from 'drizzle-orm'
import { orders, packs } from '../../../database/schema'

// Deletes a pack nobody bought; a sold one is taken off sale instead (buyers keep their tests).
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  const db = useDb()
  const [sold] = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.packId, id), eq(orders.status, 'PAID'))).limit(1)
  if (sold) await db.update(packs).set({ active: false }).where(eq(packs.id, id))
  else await db.delete(packs).where(eq(packs.id, id))
  return listPacks({ all: true, staff: true })
})
