import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, lte, ne, sql } from 'drizzle-orm'
import { attempts, liveMocks, sections, tests, users } from '../database/schema'
import { telegramApi, telegramBotToken } from './telegram'
import { MSG, asLocale } from './messages'
import { channelsOfMock, postChannels } from './channels'

/**
 * Live mocks: one test everyone sits in the same window, ranked on Listening and Reading (marked at
 * once, so the board is live). A user's first whole section of each skill in the window counts.
 * Writing and Speaking can be sat too and go to the examiner as usual, but do not rank.
 */

export const RANKED_SKILLS = ['LISTENING', 'READING']
type Mock = typeof liveMocks.$inferSelect

export const mockState = (m: Pick<Mock, 'startsAt' | 'endsAt'>, now = new Date()) =>
  m.startsAt > now ? 'UPCOMING' as const : m.endsAt > now ? 'LIVE' as const : 'ENDED' as const

/**
 * A window an admin sets: it ends after it starts, in the future, within two weeks, and overlaps no
 * other mock (`except`, the one being edited), so there is one leaderboard at a time.
 */
export async function checkWindow(startsAt: Date, endsAt: Date, except?: string) {
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw createError({ statusCode: 400, message: 'Pick when it starts and ends' })
  if (endsAt <= startsAt) throw createError({ statusCode: 400, message: 'It must end after it starts' })
  if (endsAt <= new Date()) throw createError({ statusCode: 400, message: 'That time has passed' })
  if (endsAt.getTime() - startsAt.getTime() > 14 * 864e5) throw createError({ statusCode: 400, message: 'Keep it to two weeks at most' })
  const [clash] = await useDb().select({ title: liveMocks.title }).from(liveMocks)
    .where(and(lt(liveMocks.startsAt, endsAt), gt(liveMocks.endsAt, startsAt), except ? ne(liveMocks.id, except) : undefined)).limit(1)
  if (clash) throw createError({ statusCode: 409, message: `It overlaps "${clash.title}"` })
}

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
    db.select({ slug: tests.slug, title: tests.title, module: tests.module }).from(tests).where(eq(tests.id, m.testId)).limit(1),
    db.select({ skill: sections.skill }).from(sections).where(eq(sections.testId, m.testId)).orderBy(asc(sections.position))
  ])
  const state = mockState(m, now)
  return {
    id: m.id, title: m.title, startsAt: m.startsAt, endsAt: m.endsAt, state,
    /** IELTS ranks on bands (out of 9 a skill), Multilevel on scores (out of 75). */
    exam: examOfModule(t?.module),
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

/** Everyone's place: highest total of the ranked sections first (scores, or IELTS bands), then whoever finished first; a section an admin disqualified does not count. */
export async function standings(mockId: string) {
  const rows = await useDb().execute(sql`
    select a.user_id as "userId", u.name, sum(coalesce(a.band, a.score))::float as total, max(a.submitted_at) as finished,
      json_object_agg(a.skill, coalesce(a.band, a.score)) as scores
    from attempts a join users u on u.id = a.user_id
    where a.live_mock_id = ${mockId} and a.skill in ('LISTENING', 'READING') and (a.score is not null or a.band is not null)
      and a.integrity_status is distinct from 'DISQUALIFIED'
    group by a.user_id, u.name
    order by total desc, finished asc`) as unknown as { userId: string, name: string | null, total: number, finished: string, scores: Record<string, number> }[]
  return [...rows].map((r, i) => ({ rank: i + 1, userId: r.userId, name: boardName(r.name, r.userId), total: r.total, scores: r.scores, finished: r.finished }))
}

export async function leaderboard(m: Mock, viewerId: string | null, limit = 50) {
  const [all, mine] = await Promise.all([
    standings(m.id),
    viewerId
      ? useDb().select({ skill: attempts.skill, id: attempts.id, score: attempts.score, band: attempts.band }).from(attempts)
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
    done: mine.map(a => ({ skill: a.skill, attemptId: a.id, score: a.score, band: a.band }))
  }
}

const siteUrl = () => String(useRuntimeConfig().public.siteUrl || 'https://mockmee.uz').replace(/\/$/, '')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function send(chatId: string, text: string, path: string, button: string) {
  const res = await telegramApi('sendMessage', {
    chat_id: chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: [[{ text: button, url: `${siteUrl()}${path}` }]] }
  }).catch(() => ({ ok: false }))
  await sleep(40) // well under Telegram's 30 messages a second
  return res.ok
}

// ---------- the Telegram channels ----------
// The bot posts each mock to its channels (see channels.ts): when it is scheduled, when it opens, and
// the top of the board when it closes, each in the channel's language. The bot must be an admin of
// each channel allowed to post messages.

export interface ChannelPosts { ok: boolean, error?: string, posts: { channel: string, ok: boolean, error?: string }[] }

/**
 * Posts where a mock stands to its channels (or to `only`, some of all of them): coming, open, or
 * its results. Says why when it cannot.
 */
export async function postMockToChannel(m: Mock, now = new Date(), only?: string[]): Promise<ChannelPosts> {
  const [all, [t]] = await Promise.all([
    postChannels(),
    useDb().select({ module: tests.module }).from(tests).where(eq(tests.id, m.testId)).limit(1)
  ])
  const targets = only ? all.filter(c => only.includes(c.id)) : channelsOfMock(m, examOfModule(t?.module), all)
  if (!targets.length) return { ok: false, error: all.length ? 'No channel is picked for this mock' : 'No channel is set up: add one on Live mocks', posts: [] }
  const state = mockState(m, now)
  const board = state === 'ENDED' ? await standings(m.id) : []
  if (state === 'ENDED' && !board.length) return { ok: false, error: 'Nobody took part, so there are no results to post', posts: [] }

  const posts: ChannelPosts['posts'] = []
  for (const channel of targets) {
    const l = channel.locale
    let text: string
    let path = '/live'
    let button: string
    if (state === 'UPCOMING') {
      text = MSG.liveSoon(l, m.title, m.startsAt, m.endsAt)
      button = MSG.liveSoonButton[l]
    } else if (state === 'LIVE') {
      text = MSG.liveOpen(l, m.title, m.endsAt)
      button = MSG.liveOpenButton[l]
    } else {
      text = MSG.liveBoard(l, m.title, board.slice(0, 10), board.length)
      path = `/live?mock=${m.id}`
      button = MSG.liveOverButton[l]
    }
    const res = await telegramApi('sendMessage', {
      chat_id: channel.chat, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true },
      reply_markup: { inline_keyboard: [[{ text: button, url: `${siteUrl()}${path}` }]] }
    }).catch((e: any) => ({ ok: false, description: e?.data?.description || e?.message }))
    if (!res.ok) console.warn(`[live] post to ${channel.chat} failed:`, res.description)
    posts.push(res.ok ? { channel: channel.title, ok: true } : { channel: channel.title, ok: false, error: res.description || 'the post was refused' })
    await sleep(40)
  }
  const failed = posts.filter(p => !p.ok)
  return failed.length
    ? { ok: false, error: `${failed.map(p => `${p.channel}: ${p.error}`).join('; ')}. The bot must be an admin of the channel that can post messages.`, posts }
    : { ok: true, posts }
}

/**
 * Hourly: tells everyone the bot may write to (and the channel) that a mock has started, and when one
 * has ended, tells each participant their place, posts the top of the board to the channel and puts
 * a draft test into the library.
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
    await postMockToChannel(m, now)
    const audience = await db.select({ chatId: users.telegramId, locale: users.locale }).from(users)
      .where(and(isNotNull(users.telegramId), eq(users.telegramNotify, true), eq(users.telegramBotJoined, true), eq(users.banned, false)))
    for (const u of audience) {
      const l = asLocale(u.locale)
      if (await send(u.chatId!, MSG.liveOpen(l, m.title, m.endsAt), '/live', MSG.liveOpenButton[l])) announced++
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
    await postMockToChannel(m, now)
    const chats = await db.select({ id: users.id, chatId: users.telegramId, notify: users.telegramNotify, locale: users.locale }).from(users)
      .where(inArray(users.id, board.map(r => r.userId)))
    for (const r of board) {
      const u = chats.find(c => c.id === r.userId)
      if (!u?.chatId || !u.notify) continue
      const l = asLocale(u.locale)
      if (await send(u.chatId, MSG.liveOver(l, m.title, r.rank, board.length, r.total), `/live?mock=${m.id}`, MSG.liveOverButton[l])) results++
    }
  }
  return { announced, results }
}
