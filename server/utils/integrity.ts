import { and, desc, eq, gt, inArray, isNotNull, isNull, ne, sql } from 'drizzle-orm'
import { attempts, sessions, tests, users } from '../database/schema'

/**
 * Exam integrity. The exam page notes what it sees while a section is sat (leaving the page, leaving
 * full screen, pasting into an essay); the hand-in adds what the server can see (a section finished
 * implausibly fast with a high score, two sections sat at the same time, an account used from many
 * places). An attempt with any of these is FLAGGED for an admin to look at; nobody is blocked or
 * marked down by the machine. The admin clears it, warns the candidate, or (for a live mock)
 * takes it off the board, and can sign the account out everywhere else.
 */

export interface IntegritySignals {
  /** Times the page was left (another tab or app), and for how long in all. */
  away: number
  awaySeconds: number
  fullscreenExits: number
  /** Pastes into an answer box, and how many characters they brought in. */
  pastes: number
  pastedChars: number
}

export const FLAGS = ['AWAY', 'PASTE', 'FAST', 'PARALLEL', 'DEVICES'] as const
export type Flag = (typeof FLAGS)[number]

/** What makes a flag: limits kept together so they can be read and tuned. */
const LIMIT = {
  awayTimes: 3,
  awaySeconds: 60,
  pastedChars: 200,
  /** Listening or Reading at this share right or more… */
  fastShare: 0.8,
  /** …in fewer seconds than this a question (and at least ten questions). */
  fastSecondsPerQuestion: 15,
  /** Two sections overlapping by this long were sat at the same time. */
  overlapSeconds: 120,
  /** Places (networks) one account was used from in a week. */
  places: 4
}

const count = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)))

/** The page's notes, as numbers it could have seen (anything else is dropped). */
export function cleanSignals(raw: unknown): IntegritySignals | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  return {
    away: count(r.away, 1000),
    awaySeconds: count(r.awaySeconds, 86_400),
    fullscreenExits: count(r.fullscreenExits, 1000),
    pastes: count(r.pastes, 1000),
    pastedChars: count(r.pastedChars, 1_000_000)
  }
}

/** Networks and browsers this account was used from in the last week. */
export async function placesOf(userId: string) {
  const rows = await useDb().select({ ip: sessions.ipAddress, ua: sessions.userAgent, label: sessions.deviceLabel, lastSeenAt: sessions.lastSeenAt, revokedAt: sessions.revokedAt })
    .from(sessions).where(and(eq(sessions.userId, userId), gt(sessions.lastSeenAt, new Date(Date.now() - 7 * 864e5))))
    .orderBy(desc(sessions.lastSeenAt))
  // A network is the address without its last part, so a phone moving between masts counts once.
  const net = (ip: string | null) => (ip ?? '').replace(/(\.\d+|:[0-9a-f]*)$/i, '')
  return { networks: new Set(rows.map(r => net(r.ip)).filter(Boolean)).size, sessions: rows }
}

/**
 * The flags for a section just handed in, from the page's notes and what the server knows.
 * `window` is when it was started and handed in; `marked` its right answers for Listening and Reading.
 */
export async function flagsFor(input: {
  userId: string
  attemptId?: string
  sectionId: string
  skill: string
  whole: boolean
  window: { startedAt: Date | null, submittedAt: Date }
  marked?: { correct: number, total: number } | null
  signals: IntegritySignals | null
}) {
  const flags: Flag[] = []
  const s = input.signals
  if (s && (s.away >= LIMIT.awayTimes || s.awaySeconds >= LIMIT.awaySeconds)) flags.push('AWAY')
  if (s && input.skill === 'WRITING' && s.pastedChars >= LIMIT.pastedChars) flags.push('PASTE')

  const seconds = input.window.startedAt ? (input.window.submittedAt.getTime() - input.window.startedAt.getTime()) / 1000 : null
  const m = input.marked
  if (seconds != null && m && m.total >= 10 && m.correct / m.total >= LIMIT.fastShare && seconds < m.total * LIMIT.fastSecondsPerQuestion) flags.push('FAST')

  // Another section of theirs sat over the same minutes: one person cannot sit two at once.
  if (input.window.startedAt) {
    const [other] = await useDb().select({ id: attempts.id }).from(attempts).where(and(
      eq(attempts.userId, input.userId),
      ne(attempts.sectionId, input.sectionId),
      isNotNull(attempts.startedAt),
      input.attemptId ? ne(attempts.id, input.attemptId) : undefined,
      sql`least(${attempts.submittedAt}, ${input.window.submittedAt.toISOString()}::timestamptz) - greatest(${attempts.startedAt}, ${input.window.startedAt.toISOString()}::timestamptz) > make_interval(secs => ${LIMIT.overlapSeconds})`
    )).limit(1)
    if (other) flags.push('PARALLEL')
  }
  if ((await placesOf(input.userId)).networks >= LIMIT.places) flags.push('DEVICES')
  return { flags, seconds: seconds != null ? Math.round(seconds) : null }
}

/** What an attempt stores: the page's notes and the time taken, its flags, and FLAGGED when there are any. */
export const integrityValues = (signals: IntegritySignals | null, result: { flags: Flag[], seconds: number | null }) => ({
  integrity: signals || result.seconds != null ? { ...(signals ?? {}), seconds: result.seconds } : null,
  integrityFlags: result.flags.length ? result.flags : null,
  integrityStatus: result.flags.length ? 'FLAGGED' : null
})

// ---------- the admin's queue ----------

/** Candidates with something to look at (or, `all`, everything flagged), the latest first. */
export async function integrityQueue(opts: { status?: string, search?: string } = {}) {
  const statuses = opts.status === 'ALL' ? ['FLAGGED', 'WARNED', 'CLEARED', 'DISQUALIFIED'] : opts.status ? [opts.status] : ['FLAGGED', 'WARNED']
  const search = opts.search?.trim()
  const rows = await useDb().execute(sql`
    select u.id, u.name, u.email, u.telegram_username as "telegramUsername",
      count(distinct a.id)::int as attempts,
      array_agg(distinct f) filter (where f is not null) as flags,
      max(a.submitted_at) as "lastAt",
      bool_or(a.integrity_status = 'FLAGGED') as open,
      bool_or(a.live_mock_id is not null) as "liveMock"
    from ${attempts} a
    join ${users} u on u.id = a.user_id
    left join lateral unnest(a.integrity_flags) f on true
    where a.integrity_status in (${sql.join(statuses.map(s => sql`${s}`), sql`, `)})
      ${search ? sql`and (u.name ilike ${`%${search}%`} or u.email ilike ${`%${search}%`} or u.telegram_username ilike ${`%${search}%`})` : sql``}
    group by u.id
    order by bool_or(a.integrity_status = 'FLAGGED') desc, max(a.submitted_at) desc
    limit 100`)
  return [...rows] as unknown as { id: string, name: string | null, email: string | null, telegramUsername: string | null, attempts: number, flags: Flag[] | null, lastAt: string, open: boolean, liveMock: boolean }[]
}

/** One candidate's evidence: their flagged attempts with what was seen, and where they signed in from. */
export async function integrityCase(userId: string) {
  const db = useDb()
  const [[user], rows, places] = await Promise.all([
    db.select({ id: users.id, name: users.name, email: users.email, telegramId: users.telegramId, telegramUsername: users.telegramUsername }).from(users).where(eq(users.id, userId)).limit(1),
    db.select({
      id: attempts.id, skill: attempts.skill, partNumber: attempts.partNumber, startedAt: attempts.startedAt, submittedAt: attempts.submittedAt,
      correct: attempts.correct, total: attempts.total, score: attempts.score, band: attempts.band, exam: attempts.exam,
      integrity: attempts.integrity, flags: attempts.integrityFlags, status: attempts.integrityStatus, note: attempts.integrityNote,
      reviewedAt: attempts.integrityReviewedAt, liveMockId: attempts.liveMockId, testTitle: tests.title
    }).from(attempts).leftJoin(tests, eq(tests.id, attempts.testId))
      .where(and(eq(attempts.userId, userId), isNotNull(attempts.integrityStatus)))
      .orderBy(desc(attempts.submittedAt)).limit(50),
    placesOf(userId)
  ])
  if (!user) throw createError({ statusCode: 404, message: 'User not found' })
  return {
    user,
    attempts: rows,
    networks: places.networks,
    sessions: places.sessions.map(s => ({ device: s.label || s.ua?.slice(0, 80) || null, ip: s.ip, lastSeenAt: s.lastSeenAt, signedOut: !!s.revokedAt }))
  }
}

/** The admin's decision on some attempts: cleared, warned (with the message sent) or taken off a live mock's board. */
export async function decide(adminId: string, userId: string, input: { action: 'CLEAR' | 'WARN' | 'DISQUALIFY', attemptIds?: string[], note?: string, message?: string }) {
  const db = useDb()
  const status = input.action === 'CLEAR' ? 'CLEARED' : input.action === 'WARN' ? 'WARNED' : 'DISQUALIFIED'
  const where = and(
    eq(attempts.userId, userId),
    // Only attempts that were flagged: a decision is about what stood out.
    isNotNull(attempts.integrityStatus),
    input.attemptIds?.length ? inArray(attempts.id, input.attemptIds) : inArray(attempts.integrityStatus, ['FLAGGED', 'WARNED'])
  )
  const updated = await db.update(attempts).set({
    integrityStatus: status, integrityNote: input.note?.trim().slice(0, 1000) || null, integrityReviewedAt: new Date(), integrityReviewedById: adminId
  }).where(where).returning({ id: attempts.id })
  let delivered: boolean | null = null
  if (input.action === 'WARN') {
    const text = (input.message?.trim() || 'We noticed unusual activity during your recent tests on Mockmee. Please sit tests on your own, on one device, without leaving the test page. Repeated activity like this can lead to losing access.').slice(0, 2000)
    const [tg] = await Promise.all([
      notifyTelegram(userId, { text: escapeHtml(text) }).catch(() => false),
      sendPush([userId], { title: 'Mockmee', body: text.slice(0, 180), data: { url: '/results' } }).catch(() => undefined)
    ])
    delivered = tg
  }
  return { updated: updated.length, status, delivered }
}

/** Signs the account out everywhere: every session ends, so whoever shares it has to sign in again. */
export async function signOutEverywhere(userId: string) {
  const ended = await useDb().update(sessions).set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt))).returning({ id: sessions.id })
  return { ended: ended.length }
}
