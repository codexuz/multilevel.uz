import { eq } from 'drizzle-orm'
import { orders, packs } from '../../../database/schema'

// One of my orders, as the return page waits for Click to confirm it.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')!
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 404, message: 'Order not found' })
  const [order] = await useDb().select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!order || (order.userId !== user.id && user.role !== 'admin')) throw createError({ statusCode: 404, message: 'Order not found' })
  // A pack bought: the page sends the buyer on to it.
  const [pack] = order.packId ? await useDb().select({ slug: packs.slug }).from(packs).where(eq(packs.id, order.packId)).limit(1) : []
  return { ...orderView(order), packSlug: pack?.slug ?? null }
})
