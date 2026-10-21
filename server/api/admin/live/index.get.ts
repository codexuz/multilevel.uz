import { desc, sql } from 'drizzle-orm'
import { liveMocks, tests } from '../../../database/schema'

// Every live mock, newest first, with how many took part.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const rows = await useDb().select({
    m: liveMocks,
    testTitle: tests.title,
    testStatus: tests.status,
    participants: sql<number>`(select count(distinct a.user_id)::int from attempts a where a.live_mock_id = ${liveMocks.id})`
  }).from(liveMocks).leftJoin(tests, sql`${tests.id} = ${liveMocks.testId}`).orderBy(desc(liveMocks.startsAt)).limit(100)
  const now = new Date()
  return rows.map(r => ({ ...r.m, state: mockState(r.m, now), test: { title: r.testTitle, status: r.testStatus }, participants: r.participants }))
})
