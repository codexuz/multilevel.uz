import { and, eq, gt, lt } from 'drizzle-orm'
import { liveMocks, tests } from '../../../database/schema'

// Schedules a live mock of a test. Windows may not overlap, so there is one leaderboard at a time.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = (await readBody<{ testId?: string, title?: string, startsAt?: string, endsAt?: string }>(event)) ?? {}
  const title = String(body.title ?? '').trim().slice(0, 120)
  const startsAt = new Date(String(body.startsAt))
  const endsAt = new Date(String(body.endsAt))
  if (!title) throw createError({ statusCode: 400, message: 'Give it a title' })
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw createError({ statusCode: 400, message: 'Pick when it starts and ends' })
  if (endsAt <= startsAt) throw createError({ statusCode: 400, message: 'It must end after it starts' })
  if (endsAt <= new Date()) throw createError({ statusCode: 400, message: 'That time has passed' })
  if (endsAt.getTime() - startsAt.getTime() > 14 * 864e5) throw createError({ statusCode: 400, message: 'Keep it to two weeks at most' })
  const db = useDb()
  const [test] = await db.select({ id: tests.id, status: tests.status }).from(tests).where(eq(tests.id, String(body.testId ?? ''))).limit(1)
  if (!test || test.status === 'ARCHIVED') throw createError({ statusCode: 400, message: 'Pick a test' })
  const [clash] = await db.select({ title: liveMocks.title }).from(liveMocks)
    .where(and(lt(liveMocks.startsAt, endsAt), gt(liveMocks.endsAt, startsAt))).limit(1)
  if (clash) throw createError({ statusCode: 409, message: `It overlaps "${clash.title}"` })
  const [row] = await db.insert(liveMocks).values({ testId: test.id, title, startsAt, endsAt, createdById: admin.id }).returning()
  return row
})
