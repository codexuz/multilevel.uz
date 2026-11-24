import { and, count, desc, eq, gte, lt, sql } from 'drizzle-orm'
import { attempts, courses, liveMocks, packs, tests, users } from '../../database/schema'

const TZ = 'Asia/Tashkent'

/**
 * Full Admin Panel dashboard data: KPIs with 30-day trends, daily IELTS vs CEFR exam activity,
 * recent exams / live mock sessions, and user distribution by CEFR level.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const days = [7, 30, 90].includes(Number(getQuery(event).days)) ? Number(getQuery(event).days) : 30
  const db = useDb()
  const now = new Date()
  const d30 = new Date(now.getTime() - 30 * 86_400_000)
  const d60 = new Date(now.getTime() - 60 * 86_400_000)

  const today = sql`(now() at time zone ${TZ})::date`
  const from = sql`(${today} - ${days - 1}::int)`
  const day = (col: ReturnType<typeof sql>) => sql`(${col} at time zone ${TZ})::date`
  const run = <T>(q: ReturnType<typeof sql>) => db.execute(q).then(r => [...(r as unknown as T[])])

  const [
    [totalUsersRow],
    [usersLast30Row],
    [usersPrev30Row],
    [totalTestsRow],
    [testsLast30Row],
    [testsPrev30Row],
    [liveTotalRow],
    [liveOngoingRow],
    [activePacksRow],
    [coursesRow],
    [pendingMarkingRow],
    activityRows,
    recentMocks,
    levelRows
  ] = await Promise.all([
    db.select({ n: count() }).from(users).where(eq(users.mockOnly, false)),
    db.select({ n: count() }).from(users).where(and(eq(users.mockOnly, false), gte(users.createdAt, d30))),
    db.select({ n: count() }).from(users).where(and(eq(users.mockOnly, false), gte(users.createdAt, d60), lt(users.createdAt, d30))),
    db.select({ n: count() }).from(tests),
    db.select({ n: count() }).from(tests).where(gte(tests.createdAt, d30)),
    db.select({ n: count() }).from(tests).where(and(gte(tests.createdAt, d60), lt(tests.createdAt, d30))),
    db.select({ n: count() }).from(liveMocks),
    db.select({ n: count() }).from(liveMocks).where(and(sql`${liveMocks.startsAt} <= ${now}`, sql`${liveMocks.endsAt} >= ${now}`)),
    db.select({ n: count() }).from(packs).where(eq(packs.active, true)),
    db.select({ n: count() }).from(courses),
    db.select({ n: count() }).from(attempts).where(eq(attempts.status, 'SUBMITTED')),
    run<{ day: string, ielts: number, cefr: number }>(sql`
      with d as (select generate_series(${from}, ${today}, interval '1 day')::date as day)
      select to_char(d.day, 'YYYY-MM-DD') as day,
        (select count(*)::int from attempts a where a.exam = 'IELTS' and ${day(sql`a.submitted_at`)} = d.day) as ielts,
        (select count(*)::int from attempts a where a.exam <> 'IELTS' and ${day(sql`a.submitted_at`)} = d.day) as cefr
      from d order by d.day
    `),
    db.select({
      id: liveMocks.id,
      title: liveMocks.title,
      startsAt: liveMocks.startsAt,
      endsAt: liveMocks.endsAt,
      module: tests.module,
      testSlug: tests.slug,
      candidates: sql<number>`(select count(distinct a.user_id)::int from attempts a where a.live_mock_id = ${liveMocks.id})`
    }).from(liveMocks).innerJoin(tests, eq(tests.id, liveMocks.testId)).orderBy(desc(liveMocks.startsAt)).limit(8),
    run<{ level: string, n: number }>(sql`
      select upper(coalesce(nullif(u.current_level, ''), nullif(u.target_level, ''), 'B1')) as level, count(*)::int as n
      from users u where u.mock_only = false
      group by 1
    `)
  ])

  // If there are fewer than 5 live mocks, fill with recent published tests by attempt volume.
  const recentExams: Array<{ id: string, title: string, type: 'IELTS' | 'CEFR', candidates: number, status: 'Finished' | 'Ongoing' | 'Scheduled' | 'Published', date: string, to: string }> = recentMocks.map((m) => {
    const status = now < m.startsAt ? 'Scheduled' : now <= m.endsAt ? 'Ongoing' : 'Finished'
    return {
      id: m.id,
      title: m.title,
      type: examOfModule(m.module) === 'IELTS' ? 'IELTS' : 'CEFR',
      candidates: m.candidates,
      status,
      date: m.startsAt.toISOString(),
      to: '/admin/live'
    }
  })

  if (recentExams.length < 5) {
    const recentTests = await db.select({
      id: tests.id,
      title: tests.title,
      module: tests.module,
      status: tests.status,
      createdAt: tests.createdAt,
      candidates: sql<number>`(select count(distinct a.user_id)::int from attempts a where a.test_id = ${tests.id})`
    }).from(tests).orderBy(desc(tests.createdAt)).limit(6 - recentExams.length)
    for (const t of recentTests) {
      recentExams.push({
        id: t.id,
        title: t.title,
        type: examOfModule(t.module) === 'IELTS' ? 'IELTS' : 'CEFR',
        candidates: t.candidates,
        status: t.status === 'PUBLISHED' ? 'Published' : 'Scheduled',
        date: t.createdAt.toISOString(),
        to: `/builder/tests/${t.id}`
      })
    }
  }

  const pct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0)

  const levelsOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
  const levelMap = new Map(levelRows.map(r => [r.level, Number(r.n)]))
  const totalForDist = levelsOrder.reduce((s, lv) => s + (levelMap.get(lv) ?? 0), 0)
  const cefrDistribution = levelsOrder.map((lv) => {
    const n = levelMap.get(lv) ?? 0
    return { level: lv, count: n, percent: totalForDist > 0 ? Math.round((n / totalForDist) * 100) : 0 }
  })

  return {
    days,
    kpis: {
      totalUsers: totalUsersRow?.n ?? 0,
      usersGrowthPct: pct(usersLast30Row?.n ?? 0, usersPrev30Row?.n ?? 0),
      totalTests: totalTestsRow?.n ?? 0,
      testsGrowthPct: pct(testsLast30Row?.n ?? 0, testsPrev30Row?.n ?? 0),
      liveMocksTotal: liveTotalRow?.n ?? 0,
      liveMocksOngoing: liveOngoingRow?.n ?? 0,
      activePacks: activePacksRow?.n ?? 0,
      totalCourses: coursesRow?.n ?? 0,
      pendingMarking: pendingMarkingRow?.n ?? 0
    },
    examActivity: activityRows.map(r => ({ day: r.day, ielts: Number(r.ielts), cefr: Number(r.cefr) })),
    recentExams,
    cefrDistribution
  }
})
