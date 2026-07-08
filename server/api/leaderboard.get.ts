import { desc, count, eq } from 'drizzle-orm'
import { users } from '../database/schema'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const db = useDb()
  const p = getPagination(event, 50)

  // Only students appear on the leaderboard — exclude staff (admin/examiner).
  const [totalRow] = await db.select({ total: count() }).from(users)
    .where(eq(users.role, 'student'))
  const rows = await db.select({
    id: users.id,
    name: users.name,
    avatarUrl: users.avatarUrl,
    points: users.points,
    streakCount: users.streakCount,
    currentLevel: users.currentLevel
  }).from(users)
    .where(eq(users.role, 'student'))
    .orderBy(desc(users.points))
    .limit(p.pageSize).offset(p.offset)

  // Rank is absolute across pages.
  return paginate(rows.map((r, i) => ({ rank: p.offset + i + 1, ...r })), totalRow?.total ?? 0, p)
})
