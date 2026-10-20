import { desc, eq } from 'drizzle-orm'
import { orders } from '../../database/schema'

// My purchases, newest first.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const rows = await useDb().select().from(orders).where(eq(orders.userId, user.id)).orderBy(desc(orders.createdAt)).limit(50)
  return rows.filter(o => o.status === 'PAID' || o.provider === 'click').map(orderView)
})
