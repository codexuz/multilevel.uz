import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import { classMembers, users, xpEvents } from '../database/schema'

/**
 * XP: what learners earn for their work, for a daily goal, a streak and a class's weekly table.
 * Finishing a test section, a lesson or a quiz pays once (a reference key keeps it so); practice
 * (saved words, decks) pays per right answer, up to a daily cap. A day counts for the streak when it
 * has any XP, in Tashkent time.
 */
export const XP = { test: 20, testPart: 10, lesson: 10, quiz: 15, word: 1, card: 2 } as const
/** The most a day of word and deck practice pays, so tapping through cards does not farm XP. */
const PRACTICE_CAP = 150
export const DAILY_GOALS = [10, 30, 50, 100] as const

type Source = 'test' | 'lesson' | 'quiz' | 'words' | 'deck'

/** Gives XP; with a reference key, only once for it. Returns the XP given (0 if none). */
export async function awardXp(userId: string, source: Source, amount: number, refKey: string | null = null) {
  if (amount <= 0) return 0
  const db = useDb()
  let give = Math.round(amount)
  if (!refKey && (source === 'words' || source === 'deck')) {
    const [row] = await db.select({ n: sql<number>`coalesce(sum(${xpEvents.amount}), 0)::int` }).from(xpEvents)
      .where(and(eq(xpEvents.userId, userId), inArray(xpEvents.source, ['words', 'deck']), gte(xpEvents.createdAt, tashkentDayStart())))
    give = Math.min(give, Math.max(0, PRACTICE_CAP - (row?.n ?? 0)))
    if (!give) return 0
  }
  const rows = await db.insert(xpEvents).values({ userId, source, amount: give, refKey }).onConflictDoNothing().returning({ id: xpEvents.id })
  return rows.length ? give : 0
}

/** Gives XP without letting a failure stop what earned it. */
export function awardXpQuietly(userId: string, source: Source, amount: number, refKey: string | null = null) {
  return awardXp(userId, source, amount, refKey).catch((e) => {
    console.error('[xp] not given:', e)
    return 0
  })
}

/** Level n is reached at 40·(n−1)² XP: 40, 160, 360, 640… */
export const levelOf = (total: number) => 1 + Math.floor(Math.sqrt(total / 40))
export const xpForLevel = (level: number) => 40 * (level - 1) ** 2

const dayKey = (d: Date) => new Date(tashkentDayStart(d).getTime() + 5 * 3_600_000).toISOString().slice(0, 10)

/** Today's XP against the goal, the streak, the last seven days, the total and the level. */
export async function xpSummary(userId: string) {
  const db = useDb()
  const since = new Date(Date.now() - 400 * 86_400_000)
  const [days, [tot], [u]] = await Promise.all([
    db.select({
      day: sql<string>`to_char((${xpEvents.createdAt} at time zone 'Asia/Tashkent')::date, 'YYYY-MM-DD')`,
      xp: sql<number>`sum(${xpEvents.amount})::int`
    }).from(xpEvents).where(and(eq(xpEvents.userId, userId), gte(xpEvents.createdAt, since)))
      .groupBy(sql`1`).orderBy(desc(sql`1`)),
    db.select({ n: sql<number>`coalesce(sum(${xpEvents.amount}), 0)::int` }).from(xpEvents).where(eq(xpEvents.userId, userId)),
    db.select({ goal: users.dailyGoal }).from(users).where(eq(users.id, userId)).limit(1)
  ])
  const byDay = new Map(days.map(d => [d.day, d.xp]))
  const today = dayKey(new Date())
  const dayBefore = (key: string) => dayKey(new Date(new Date(`${key}T12:00:00+05:00`).getTime() - 86_400_000))

  // The streak runs back from today, or from yesterday while today has no XP yet (still alive).
  let streak = 0
  let cursor = byDay.has(today) ? today : dayBefore(today)
  while (byDay.has(cursor)) {
    streak++
    cursor = dayBefore(cursor)
  }
  const week: { day: string, xp: number }[] = []
  for (let i = 6, k = today; i >= 0; i--) {
    week.unshift({ day: k, xp: byDay.get(k) ?? 0 })
    k = dayBefore(k)
  }
  const total = tot?.n ?? 0
  const level = levelOf(total)
  return {
    today: byDay.get(today) ?? 0,
    goal: u?.goal ?? 30,
    streak,
    extendedToday: byDay.has(today),
    week,
    total,
    level,
    levelFrom: xpForLevel(level),
    levelTo: xpForLevel(level + 1)
  }
}

/** A class's last seven days of XP, best first (members only; the teacher is left out). */
export async function classXpTable(groupId: string) {
  const db = useDb()
  const since = new Date(Date.now() - 7 * 86_400_000)
  const members = await db.select({ id: users.id }).from(classMembers).innerJoin(users, eq(users.id, classMembers.userId)).where(eq(classMembers.groupId, groupId))
  const ids = members.map(m => m.id)
  if (!ids.length) return new Map<string, number>()
  const rows = await db.select({ userId: xpEvents.userId, xp: sql<number>`sum(${xpEvents.amount})::int` }).from(xpEvents)
    .where(and(inArray(xpEvents.userId, ids), gte(xpEvents.createdAt, since))).groupBy(xpEvents.userId)
  return new Map(rows.map(r => [r.userId, r.xp]))
}
