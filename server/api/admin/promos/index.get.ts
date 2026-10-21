import { desc, sql } from 'drizzle-orm'
import { orders, promoCodes } from '../../../database/schema'

// Every promo code, newest first, with what it has brought in.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDb()
  const rows = await db.select({
    promo: promoCodes,
    revenue: sql<number>`coalesce((select sum(${orders.amountUzs}) from ${orders} where ${orders.promoCodeId} = ${promoCodes.id} and ${orders.status} = 'PAID'), 0)::int`,
    discount: sql<number>`coalesce((select sum(${orders.discountUzs}) from ${orders} where ${orders.promoCodeId} = ${promoCodes.id} and ${orders.status} = 'PAID'), 0)::int`
  }).from(promoCodes).orderBy(desc(promoCodes.createdAt))
  return rows.map(r => ({ ...r.promo, text: promoText(r.promo), revenueUzs: r.revenue, discountUzs: r.discount }))
})
