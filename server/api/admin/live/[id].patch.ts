import { eq } from 'drizzle-orm'
import { liveMocks, tests } from '../../../database/schema'

/**
 * Changes a live mock. Its title and the channels it goes to can change at any time. Before it opens, its test and its window
 * too; while it runs, when it closes (the board so far stays). Once it has ended, only the title.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDb()
  const [m] = await db.select().from(liveMocks).where(eq(liveMocks.id, String(getRouterParam(event, 'id')))).limit(1)
  if (!m) throw createError({ statusCode: 404, message: 'Live mock not found' })
  const body = (await readBody<{ testId?: string, title?: string, startsAt?: string, endsAt?: string, channelIds?: string[] }>(event)) ?? {}
  const state = mockState(m)
  const set: Partial<typeof liveMocks.$inferInsert> = {}

  if (body.title !== undefined) {
    const title = String(body.title).trim().slice(0, 120)
    if (!title) throw createError({ statusCode: 400, message: 'Give it a title' })
    set.title = title
  }
  if (body.channelIds !== undefined) set.channelIds = await pickChannels(body.channelIds)
  if (body.testId !== undefined && body.testId !== m.testId) {
    if (state !== 'UPCOMING') throw createError({ statusCode: 409, message: 'It has started, so its test stays' })
    const [test] = await db.select({ id: tests.id, status: tests.status }).from(tests).where(eq(tests.id, String(body.testId))).limit(1)
    if (!test || test.status === 'ARCHIVED') throw createError({ statusCode: 400, message: 'Pick a test' })
    set.testId = test.id
  }
  const startsAt = body.startsAt !== undefined ? new Date(String(body.startsAt)) : m.startsAt
  const endsAt = body.endsAt !== undefined ? new Date(String(body.endsAt)) : m.endsAt
  const moved = startsAt.getTime() !== m.startsAt.getTime() || endsAt.getTime() !== m.endsAt.getTime()
  if (moved) {
    if (state === 'ENDED') throw createError({ statusCode: 409, message: 'It has ended, so its window stays' })
    if (state === 'LIVE' && startsAt.getTime() !== m.startsAt.getTime()) throw createError({ statusCode: 409, message: 'It has started: only when it closes can change' })
    await checkWindow(startsAt, endsAt, m.id)
    set.startsAt = startsAt
    set.endsAt = endsAt
  }
  if (!Object.keys(set).length) return m
  const [row] = await db.update(liveMocks).set(set).where(eq(liveMocks.id, m.id)).returning()
  return row
})
