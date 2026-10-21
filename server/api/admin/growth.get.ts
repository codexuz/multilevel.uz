import { sql } from 'drizzle-orm'

/**
 * Growth over the last 7, 30 or 90 days (Tashkent days), each figure beside the period before:
 * daily signups, active users and revenue; the signup funnel; where signups came from; weekly
 * retention of the last eight weeks' signups; the most sat tests and revenue by plan. Paid means an
 * order that cost money (not a promo or a free grant).
 */
const TZ = 'Asia/Tashkent'
type Rows<T> = T[]

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const days = [7, 30, 90].includes(Number(getQuery(event).days)) ? Number(getQuery(event).days) : 30
  const db = useDb()
  const run = <T>(q: ReturnType<typeof sql>) => db.execute(q).then(r => [...(r as unknown as Rows<T>)])

  // The period: the last `days` Tashkent days including today, and the same length before it.
  const today = sql`(now() at time zone ${TZ})::date`
  const from = sql`(${today} - ${days - 1}::int)`
  const prevFrom = sql`(${today} - ${2 * days - 1}::int)`
  const day = (col: ReturnType<typeof sql>) => sql`(${col} at time zone ${TZ})::date`
  const paid = sql`o.status = 'PAID' and o.amount_uzs > 0`

  const [daily, totals, funnel, sources, cohorts, topTests, byPlan] = await Promise.all([
    run<{ day: string, signups: number, active: number, attempts: number, revenue: number }>(sql`
      with d as (select generate_series(${from}, ${today}, interval '1 day')::date as day)
      select to_char(d.day, 'YYYY-MM-DD') as day,
        (select count(*)::int from users u where ${day(sql`u.created_at`)} = d.day) as signups,
        (select count(distinct a.user_id)::int from attempts a where ${day(sql`a.submitted_at`)} = d.day) as active,
        (select count(*)::int from attempts a where ${day(sql`a.submitted_at`)} = d.day) as attempts,
        (select coalesce(sum(o.amount_uzs), 0)::int from orders o where ${paid} and ${day(sql`o.paid_at`)} = d.day) as revenue
      from d order by d.day`),
    run<{ period: 'now' | 'before', signups: number, active: number, attempts: number, revenue: number, orders: number, buyers: number, ai: number }>(sql`
      with p as (select 'now' as period, ${from} as a, ${today} as b union all select 'before', ${prevFrom}, ${from} - 1)
      select p.period,
        (select count(*)::int from users u where ${day(sql`u.created_at`)} between p.a and p.b) as signups,
        (select count(distinct a.user_id)::int from attempts a where ${day(sql`a.submitted_at`)} between p.a and p.b) as active,
        (select count(*)::int from attempts a where ${day(sql`a.submitted_at`)} between p.a and p.b) as attempts,
        (select coalesce(sum(o.amount_uzs), 0)::int from orders o where ${paid} and ${day(sql`o.paid_at`)} between p.a and p.b) as revenue,
        (select count(*)::int from orders o where ${paid} and ${day(sql`o.paid_at`)} between p.a and p.b) as orders,
        (select count(distinct o.user_id)::int from orders o where ${paid} and ${day(sql`o.paid_at`)} between p.a and p.b) as buyers,
        (select count(*)::int from ai_reviews r where r.status = 'DONE' and ${day(sql`r.created_at`)} between p.a and p.b) as ai
      from p`),
    run<{ signed: number, onboarded: number, sat: number, bot: number, paid: number }>(sql`
      select count(*)::int as signed,
        count(*) filter (where u.onboarded)::int as onboarded,
        count(*) filter (where exists (select 1 from attempts a where a.user_id = u.id))::int as sat,
        count(*) filter (where u.telegram_bot_joined)::int as bot,
        count(*) filter (where exists (select 1 from orders o where o.user_id = u.id and ${paid}))::int as paid
      from users u where ${day(sql`u.created_at`)} >= ${from}`),
    run<{ telegram: number, google: number, both: number, invited: number }>(sql`
      select count(*) filter (where u.telegram_id is not null and u.email is null)::int as telegram,
        count(*) filter (where u.email is not null and u.telegram_id is null)::int as google,
        count(*) filter (where u.email is not null and u.telegram_id is not null)::int as both,
        count(*) filter (where u.referred_by_id is not null)::int as invited
      from users u where ${day(sql`u.created_at`)} >= ${from}`),
    // Weeks start on Monday. Week k: the share of the cohort that sat anything k weeks after joining.
    run<{ week: string, size: number, w1: number | null, w2: number | null, w3: number | null, w4: number | null }>(sql`
      with c as (
        select u.id, date_trunc('week', u.created_at at time zone ${TZ})::date as week from users u
        where u.created_at at time zone ${TZ} >= date_trunc('week', now() at time zone ${TZ}) - interval '7 weeks'
      ), act as (
        select distinct a.user_id, date_trunc('week', a.submitted_at at time zone ${TZ})::date as week from attempts a
      )
      select to_char(c.week, 'YYYY-MM-DD') as week, count(*)::int as size,
        ${sql.join([1, 2, 3, 4].map(k => sql`case when c.week + ${7 * k}::int <= (now() at time zone ${TZ})::date
          then count(*) filter (where exists (select 1 from act where act.user_id = c.id and act.week = c.week + ${7 * k}::int))::int end as ${sql.raw(`w${k}`)}`), sql`, `)}
      from c group by c.week order by c.week`),
    run<{ title: string, attempts: number, people: number }>(sql`
      select t.title, count(*)::int as attempts, count(distinct a.user_id)::int as people
      from attempts a join tests t on t.id = a.test_id
      where ${day(sql`a.submitted_at`)} >= ${from}
      group by t.title order by attempts desc limit 5`),
    run<{ plan: string, orders: number, revenue: number }>(sql`
      select o.plan_name as plan, count(*)::int as orders, sum(o.amount_uzs)::int as revenue
      from orders o where ${paid} and ${day(sql`o.paid_at`)} >= ${from}
      group by o.plan_name order by revenue desc`)
  ])

  const now = totals.find(t => t.period === 'now')!
  const before = totals.find(t => t.period === 'before')!
  const pair = (k: keyof typeof now) => ({ now: Number(now[k]), before: Number(before[k]) })
  return {
    days,
    kpis: {
      signups: pair('signups'), active: pair('active'), attempts: pair('attempts'),
      revenue: pair('revenue'), orders: pair('orders'), buyers: pair('buyers'), ai: pair('ai')
    },
    daily,
    funnel: funnel[0],
    sources: sources[0],
    cohorts,
    topTests,
    byPlan
  }
})
