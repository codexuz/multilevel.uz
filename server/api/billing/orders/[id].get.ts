import { eq } from 'drizzle-orm'
import { orders } from '../../../database/schema'

// One of my orders, as the return page waits for Click to confirm it.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')!
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 404, message: 'Order not found' })
  const [order] = await useDb().select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!order || (order.userId !== user.id && user.role !== 'admin')) throw createError({ statusCode: 404, message: 'Order not found' })
  return orderView(order)
})
