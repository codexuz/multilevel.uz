import { desc, eq, sql } from 'drizzle-orm'
import { centreRequests, users } from '../../../../database/schema'

// Requests to join as a centre: waiting ones first, then the latest decided.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const rows = await useDb().select({ r: centreRequests, name: users.name, email: users.email, telegramUsername: users.telegramUsername })
    .from(centreRequests).innerJoin(users, eq(users.id, centreRequests.userId))
    .orderBy(sql`${centreRequests.status} = 'PENDING' desc`, desc(centreRequests.createdAt)).limit(100)
  return rows.map(({ r, ...u }) => ({
    id: r.id, name: r.name, city: r.city, phone: r.phone, telegram: r.telegram, students: r.students, message: r.message,
    status: r.status, centreId: r.centreId, createdAt: r.createdAt, reviewedAt: r.reviewedAt,
    user: { id: r.userId, name: userLabel(u), email: u.email, telegramUsername: u.telegramUsername }
  }))
})
