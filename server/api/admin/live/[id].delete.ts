import { eq } from 'drizzle-orm'
import { liveMocks } from '../../../database/schema'

// Cancels a live mock that has not started. One that started keeps its leaderboard.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDb()
  const [m] = await db.select().from(liveMocks).where(eq(liveMocks.id, String(getRouterParam(event, 'id')))).limit(1)
  if (!m) throw createError({ statusCode: 404, message: 'Live mock not found' })
  if (mockState(m) !== 'UPCOMING') throw createError({ statusCode: 409, message: 'It has started, so its leaderboard stays' })
  await db.delete(liveMocks).where(eq(liveMocks.id, m.id))
  return { ok: true }
})
