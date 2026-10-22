import { eq } from 'drizzle-orm'
import { liveMocks, tests } from '../../../database/schema'

// Schedules a live mock of a test, and announces it in the Telegram channel when there is one.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = (await readBody<{ testId?: string, title?: string, startsAt?: string, endsAt?: string }>(event)) ?? {}
  const title = String(body.title ?? '').trim().slice(0, 120)
  const startsAt = new Date(String(body.startsAt))
  const endsAt = new Date(String(body.endsAt))
  if (!title) throw createError({ statusCode: 400, message: 'Give it a title' })
  await checkWindow(startsAt, endsAt)
  const db = useDb()
  const [test] = await db.select({ id: tests.id, status: tests.status }).from(tests).where(eq(tests.id, String(body.testId ?? ''))).limit(1)
  if (!test || test.status === 'ARCHIVED') throw createError({ statusCode: 400, message: 'Pick a test' })
  const [row] = await db.insert(liveMocks).values({ testId: test.id, title, startsAt, endsAt, createdById: admin.id }).returning()
  // One that opens at once is announced by the hourly job, with everyone's messages.
  const channel = telegramChannel() && mockState(row!) === 'UPCOMING' ? await postMockToChannel(row!) : null
  return { ...row, channel }
})
