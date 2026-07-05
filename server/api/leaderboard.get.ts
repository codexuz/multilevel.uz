import { desc } from 'drizzle-orm'
import { users } from '../database/schema'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const db = useDb()
  const rows = await db.select({
    id: users.id,
    name: users.name,
    avatarUrl: users.avatarUrl,
    points: users.points,
    streakCount: users.streakCount,
    currentLevel: users.currentLevel
  }).from(users).orderBy(desc(users.points)).limit(50)

  return rows.map((r, i) => ({ rank: i + 1, ...r }))
})
