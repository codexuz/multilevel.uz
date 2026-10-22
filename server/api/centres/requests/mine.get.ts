import { desc, eq } from 'drizzle-orm'
import { centreRequests } from '../../../database/schema'

// My latest request to join as a centre, if any (for /centres/apply).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const [row] = await useDb().select().from(centreRequests).where(eq(centreRequests.userId, user.id))
    .orderBy(desc(centreRequests.createdAt)).limit(1)
  return row ? { id: row.id, name: row.name, status: row.status, centreId: row.centreId, createdAt: row.createdAt } : null
})
