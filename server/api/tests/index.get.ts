import { eq, desc } from 'drizzle-orm'
import { tests } from '../../database/schema'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const db = useDb()
  const rows = await db.select().from(tests).where(eq(tests.status, 'published')).orderBy(desc(tests.createdAt))
  return rows.map(t => ({
    id: t.id,
    title: t.title,
    description: t.description,
    level: t.level,
    status: t.status,
    isPremium: t.isPremium,
    createdAt: t.createdAt
  }))
})
