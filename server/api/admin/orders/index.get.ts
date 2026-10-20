import { and, count, desc, eq, gte, sql } from 'drizzle-orm'
import { orders } from '../../../database/schema'

// Orders, newest first, with what was taken this month.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
  const status = ['PENDING', 'PAID', 'CANCELLED'].includes(String(query.status)) ? String(query.status) : null
  const where = status ? eq(orders.status, status) : undefined
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const db = useDb()
  const [rows, [total], [month]] = await Promise.all([
    db.query.orders.findMany({ where, with: { user: true }, orderBy: [desc(orders.createdAt)], limit, offset: (page - 1) * limit }),
    db.select({ n: count() }).from(orders).where(where),
    db.select({ sum: sql<number>`coalesce(sum(${orders.amountUzs}), 0)::int`, n: count() }).from(orders)
      .where(and(eq(orders.status, 'PAID'), gte(orders.paidAt, monthStart)))
  ])
  return { ...paged(rows.map(orderView), total?.n ?? 0, page, limit), month: { revenueUzs: month?.sum ?? 0, paid: month?.n ?? 0 } }
})
