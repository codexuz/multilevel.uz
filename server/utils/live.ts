import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lte, sql } from 'drizzle-orm'
import { attempts, liveMocks, sections, tests, users } from '../database/schema'
import { telegramApi, telegramBotToken } from './telegram'

/**
 * Live mocks: one test everyone sits in the same window, ranked on Listening and Reading (marked at
 * once, so the board is live). A user's first whole section of each skill in the window counts.
 * Writing and Speaking can be sat too and go to the examiner as usual, but do not rank.
 */

export const RANKED_SKILLS = ['LISTENING', 'READING']
type Mock = typeof liveMocks.$inferSelect

export const mockState = (m: Pick<Mock, 'startsAt' | 'endsAt'>, now = new Date()) =>
  m.startsAt > now ? 'UPCOMING' as const : m.endsAt > now ? 'LIVE' as const : 'ENDED' as const

/** The live mock of this test that is open now, if any. */
export async function openMockOfTest(testId: string, now = new Date()) {
  const [m] = await useDb().select().from(liveMocks)
    .where(and(eq(liveMocks.testId, testId), lte(liveMocks.startsAt, now), gt(liveMocks.endsAt, now))).limit(1)
  return m ?? null
}

/** A mock as the site shows it: its window, its state and the test's sections. */
export async function mockView(m: Mock, now = new Date()) {
  const db = useDb()
  const [[t], skills] = await Promise.all([
    db.select({ slug: tests.slug, title: tests.title }).from(tests).where(eq(tests.id, m.testId)).limit(1),
    db.select({ skill: sections.skill }).from(sections).where(eq(sections.testId, m.testId)).orderBy(asc(sections.position))
  ])
  const state = mockState(m, now)
  return {
    id: m.id, title: m.title, startsAt: m.startsAt, endsAt: m.endsAt, state,
    // Before it opens, which test it is stays a secret.
    test: state === 'UPCOMING' || !t ? null : { slug: t.slug, title: t.title },
    skills: skills.map(s => s.skill)
  }
}

/** A name for the board: the first name and the initial of the last, never a username. */
function boardName(name: string | null, id: string) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return `Candidate ${id.slice(0, 4).toUpperCase()}`
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]!.charAt(0)}.` : parts[0]!
}

/** Everyone's place: highest total of the ranked sections first, then whoever finished first. */
export async function standings(mockId: string) {
  const rows = await useDb().execute(sql`
    select a.user_id as "userId", u.name, sum(a.score)::int as total, max(a.submitted_at) as finished,
      json_object_agg(a.skill, a.score) as scores
    from attempts a join users u on u.id = a.user_id
    where a.live_mock_id = ${mockId} and a.skill in ('LISTENING', 'READING') and a.score is not null
    group by a.user_id, u.name
    order by total desc, finished asc`) as unknown as { userId: string, name: string | null, total: number, finished: string, scores: Record<string, number> }[]
  return [...rows].map((r, i) => ({ rank: i + 1, userId: r.userId, name: boardName(r.name, r.userId), total: r.total, scores: r.scores, finished: r.finished }))
}

export async function leaderboard(m: Mock, viewerId: string | null, limit = 50) {
  const [all, mine] = await Promise.all([
    standings(m.id),
    viewerId
      ? useDb().select({ skill: attempts.skill, id: attempts.id, score: attempts.score }).from(attempts)
          .where(and(eq(attempts.liveMockId, m.id), eq(attempts.userId, viewerId)))
      : Promise.resolve([])
  ])
  const strip = ({ userId, ...r }: typeof all[number]) => ({ ...r, you: userId === viewerId })
  const me = viewerId ? all.find(r => r.userId === viewerId) : undefined
  return {
    participants: all.length,
    top: all.slice(0, limit).map(strip),
    me: me ? strip(me) : null,
    /** The sections the viewer has already sat in this mock (each counts once). */
    done: mine.map(a => ({ skill: a.skill, attemptId: a.id, score: a.score }))
  }
}

const siteUrl = () => String(useRuntimeConfig().public.siteUrl || 'https://multilevel.uz').replace(/\/$/, '')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`
const endsText = (d: Date) => d.toLocaleString('en-GB', { weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tashkent' })

async function send(chatId: string, text: string, path: string, button: string) {
  const res = await telegramApi('sendMessage', {
    chat_id: chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: [[{ text: button, url: `${siteUrl()}${path}` }]] }
  }).catch(() => ({ ok: false }))
  await sleep(40) // well under Telegram's 30 messages a second
  return res.ok
}

/**
 * Hourly: tells everyone the bot may write to that a mock has started, and when one has ended, tells
 * each participant their place and puts a draft test into the library.
 */
export async function runLiveMocks(now = new Date()) {
  const db = useDb()
  let announced = 0
  let results = 0
  const started = await db.select().from(liveMocks)
    .where(and(lte(liveMocks.startsAt, now), gt(liveMocks.endsAt, now), isNull(liveMocks.announcedAt)))
  for (const m of started) {
    await db.update(liveMocks).set({ announcedAt: now }).where(eq(liveMocks.id, m.id))
    if (!telegramBotToken()) continue
    const audience = await db.select({ chatId: users.telegramId }).from(users)
      .where(and(isNotNull(users.telegramId), eq(users.telegramNotify, true), eq(users.telegramBotJoined, true), eq(users.banned, false)))
    for (const u of audience) {
      if (await send(u.chatId!, `🏆 <b>${m.title} is live</b>\nSit it by ${endsText(m.endsAt)}: Listening and Reading are ranked on one leaderboard. Your first try of each counts.`, '/live', 'Take part')) announced++
    }
  }

  const ended = await db.select().from(liveMocks)
    .where(and(lte(liveMocks.endsAt, now), isNull(liveMocks.resultsSentAt)))
    .orderBy(desc(liveMocks.endsAt))
  for (const m of ended) {
    await db.update(liveMocks).set({ resultsSentAt: now }).where(eq(liveMocks.id, m.id))
    await db.update(tests).set({ status: 'PUBLISHED', publishedAt: now }).where(and(eq(tests.id, m.testId), eq(tests.status, 'DRAFT')))
    if (!telegramBotToken()) continue
    const board = await standings(m.id)
    if (!board.length) continue
    const chats = await db.select({ id: users.id, chatId: users.telegramId, notify: users.telegramNotify }).from(users)
      .where(inArray(users.id, board.map(r => r.userId)))
    for (const r of board) {
      const u = chats.find(c => c.id === r.userId)
      if (!u?.chatId || !u.notify) continue
      if (await send(u.chatId, `🏁 <b>${m.title} is over</b>\nYou placed <b>${ordinal(r.rank)}</b> of ${board.length}, with ${r.total} points. Thanks for taking part!`, `/live?mock=${m.id}`, 'See the leaderboard')) results++
    }
  }
  return { announced, results }
}
