import { eq, desc, count } from 'drizzle-orm'
import { tests } from '../../database/schema'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const db = useDb()
  const p = getPagination(event)

  const [totalRow] = await db.select({ total: count() }).from(tests)
    .where(eq(tests.status, 'published'))
  const rows = await db.select().from(tests)
    .where(eq(tests.status, 'published'))
    .orderBy(desc(tests.createdAt))
    .limit(p.pageSize).offset(p.offset)

  return paginate(rows.map(t => ({
    id: t.id,
    title: t.title,
    description: t.description,
    level: t.level,
    status: t.status,
    isPremium: t.isPremium,
    createdAt: t.createdAt
  })), totalRow?.total ?? 0, p)
})
