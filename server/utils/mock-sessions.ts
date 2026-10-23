import type { H3Event } from 'h3'
import { randomBytes, randomInt } from 'node:crypto'
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'
import { aiReviews, attempts, centreMembers, centres, mockCandidates, mockCreditTransactions, mockSessions, sections, sessions, tests, users } from '../database/schema'

/**
 * Mock sessions: a learning centre (its owner or a teacher, while its licence runs) or a teacher
 * runs a mock on its own computers, as erp-lms's IELTS mock centre does.
 *
 * - The session: a test, a time, a room; walk-ins pay at the desk; results can be held.
 * - Candidates: the centre's students, or walk-ins registered with their name, phone and ID number
 *   (an account is made for them that signs in only at their seat).
 * - Check-in: the invigilator sees the ID and gives a six-digit seat code, single use, good from an
 *   hour before the session to its end. Checking in again gives a new code and ends the old seat.
 *   The first check-in spends one mock credit (the centre's, or the teacher's).
 * - The seat: any room computer showing /seat. The code signs the candidate in for this session
 *   only; they sit each section the invigilator opens, in the exam interface, and the page sends
 *   what it sees (integrity.ts) to the board as it goes.
 * - Marks: Listening and Reading at once; Writing from the AI's estimate unless the invigilator
 *   gives a mark; Speaking, held face to face, marked on the board.
 * - Results: announced per candidate once complete, as a report page opened by its link or QR code.
 */

type Db = ReturnType<typeof useDb>
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
type Session = typeof mockSessions.$inferSelect
type Candidate = typeof mockCandidates.$inferSelect

export const ONLINE_SKILLS = ['LISTENING', 'READING', 'WRITING'] as const
/** A seat code opens an hour before the session and until it closes. */
const SEAT_EARLY_MS = 60 * 60 * 1000
const notFound = () => createError({ statusCode: 404, message: 'Mock session not found' })
const bad = (message: string) => createError({ statusCode: 400, message })
const conflict = (message: string) => createError({ statusCode: 409, message })

// ---------- who may run sessions ----------

/** The roles that run mock sessions. */
export const MOCK_ROLES = ['teacher', 'center_owner', 'admin']

export interface MockScope { kind: 'CENTRE' | 'TEACHER', centreId: string | null, name: string, credits: number }

/** Mock credits left: a centre's, or a teacher's own. */
export async function creditBalance(owner: { centreId: string | null, userId?: string | null }, db: Db | Tx = useDb()) {
  const [row] = await db.select({ n: sql<number>`coalesce(sum(${mockCreditTransactions.delta}), 0)::int` }).from(mockCreditTransactions)
    .where(owner.centreId ? eq(mockCreditTransactions.centreId, owner.centreId) : and(eq(mockCreditTransactions.userId, owner.userId!), isNull(mockCreditTransactions.centreId)))
  return row?.n ?? 0
}

/**
 * Where this user can run sessions, by their role: a teacher or centre owner, each centre they own or
 * teach at (licence running); a teacher (or an admin), their own as well. Students run none.
 */
export async function scopesOf(user: { id: string, role: string }): Promise<MockScope[]> {
  if (!MOCK_ROLES.includes(user.role)) return []
  const db = useDb()
  const [rows, [me]] = await Promise.all([
    db.select({ id: centres.id, name: centres.name, active: centres.active, licensedUntil: centres.licensedUntil }).from(centreMembers)
      .innerJoin(centres, eq(centres.id, centreMembers.centreId))
      .where(and(eq(centreMembers.userId, user.id), inArray(centreMembers.role, ['OWNER', 'TEACHER']))),
    db.select({ mockOnly: users.mockOnly }).from(users).where(eq(users.id, user.id)).limit(1)
  ])
  if (me?.mockOnly) return []
  const out: MockScope[] = []
  for (const c of rows.filter(r => licenceOpen(r))) out.push({ kind: 'CENTRE', centreId: c.id, name: c.name, credits: await creditBalance({ centreId: c.id }) })
  if (user.role === 'teacher' || user.role === 'admin') out.push({ kind: 'TEACHER', centreId: null, name: 'Own', credits: await creditBalance({ centreId: null, userId: user.id }) })
  return out
}

/** The session, for whoever may run it: its centre's owner or teachers, the teacher who made it, or an admin. */
export async function requireSession(event: H3Event, id: string) {
  const user = await requireUser(event)
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound()
  const [s] = await useDb().select().from(mockSessions).where(eq(mockSessions.id, id)).limit(1)
  if (!s) throw notFound()
  if (user.role === 'admin') return { user, session: s }
  if (s.centreId) {
    const [m] = await useDb().select({ role: centreMembers.role }).from(centreMembers)
      .where(and(eq(centreMembers.centreId, s.centreId), eq(centreMembers.userId, user.id))).limit(1)
    if (!m || m.role === 'STUDENT') throw notFound()
  } else if (s.ownerId !== user.id) throw notFound()
  return { user, session: s }
}

// ---------- sessions ----------

const skillsOfTest = async (testId: string) => (await useDb().select({ skill: sections.skill }).from(sections)
  .where(and(eq(sections.testId, testId), sql`exists (select 1 from section_items si where si.section_id = ${sections.id})`))
  .orderBy(asc(sections.position))).map(s => s.skill)

/** The sessions this user can run, newest first, with how many candidates each has. */
export async function listSessions(user: { id: string, role: string }) {
  const scopes = await scopesOf(user)
  const centreIds = scopes.filter(s => s.centreId).map(s => s.centreId!)
  const rows = await useDb().select({
    s: mockSessions, testTitle: tests.title, module: tests.module, centreName: centres.name,
    candidates: sql<number>`(select count(*)::int from ${mockCandidates} c where c.session_id = ${mockSessions.id})`,
    checkedIn: sql<number>`(select count(*)::int from ${mockCandidates} c where c.session_id = ${mockSessions.id} and c.checked_in_at is not null)`,
    // Started: someone took a seat or handed a section in (then it stays, for their results).
    started: sql<boolean>`exists (select 1 from ${mockCandidates} c where c.session_id = ${mockSessions.id} and (c.seated_at is not null or exists (select 1 from ${attempts} a where a.mock_candidate_id = c.id)))`
  }).from(mockSessions)
    .innerJoin(tests, eq(tests.id, mockSessions.testId))
    .leftJoin(centres, eq(centres.id, mockSessions.centreId))
    .where(or(
      centreIds.length ? inArray(mockSessions.centreId, centreIds) : sql`false`,
      and(isNull(mockSessions.centreId), eq(mockSessions.ownerId, user.id))
    ))
    .orderBy(desc(mockSessions.opensAt)).limit(200)
  return {
    scopes,
    sessions: rows.map(r => ({ ...r.s, test: { title: r.testTitle, exam: examOfModule(r.module) }, centreName: r.centreName, candidates: r.candidates, checkedIn: r.checkedIn, started: r.started }))
  }
}

type SessionBody = { centreId?: string | null, title?: string, testId?: string, opensAt?: string, closesAt?: string, room?: string | null, capacity?: number | null, priceUzs?: number | null, holdResults?: boolean, status?: string }
const int = (v: unknown, min: number, max: number) => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Math.round(Number(v)))) : null)

/** The fields of a session as the form sends them; only those given are kept. */
async function sessionValues(body: SessionBody, partial: boolean) {
  const out: Partial<typeof mockSessions.$inferInsert> = {}
  if (body.title !== undefined || !partial) {
    const title = String(body.title ?? '').trim().slice(0, 120)
    if (!title) throw bad('Give the session a title')
    out.title = title
  }
  if (body.testId !== undefined || !partial) {
    const [t] = await useDb().select({ id: tests.id, status: tests.status }).from(tests).where(eq(tests.id, String(body.testId ?? ''))).limit(1)
    if (!t || t.status !== 'PUBLISHED') throw bad('Pick a published test')
    if (!(await skillsOfTest(t.id)).some(s => (ONLINE_SKILLS as readonly string[]).includes(s))) throw bad('That test has nothing to sit on screen')
    out.testId = t.id
  }
  if (body.opensAt !== undefined || body.closesAt !== undefined || !partial) {
    const opensAt = new Date(String(body.opensAt))
    const closesAt = new Date(String(body.closesAt))
    if (Number.isNaN(opensAt.getTime()) || Number.isNaN(closesAt.getTime())) throw bad('Pick when it opens and closes')
    if (closesAt <= opensAt) throw bad('It must close after it opens')
    if (closesAt.getTime() - opensAt.getTime() > 2 * 864e5) throw bad('Keep a session to two days at most')
    out.opensAt = opensAt
    out.closesAt = closesAt
  }
  if (body.room !== undefined) out.room = String(body.room ?? '').trim().slice(0, 80) || null
  if (body.capacity !== undefined) out.capacity = int(body.capacity, 1, 500)
  if (body.priceUzs !== undefined) out.priceUzs = int(body.priceUzs, 0, 50_000_000)
  if (body.holdResults !== undefined) out.holdResults = !!body.holdResults
  if (body.status !== undefined) {
    if (body.status !== 'ACTIVE' && body.status !== 'ARCHIVED') throw bad('Unknown status')
    out.status = body.status
  }
  return out
}

/** A new session, for a centre this user runs sessions for, or their own as a teacher. */
export async function createSession(user: { id: string, role: string }, body: SessionBody) {
  const scopes = await scopesOf(user)
  const centreId = body.centreId || null
  if (!scopes.some(s => s.centreId === centreId)) {
    throw createError({ statusCode: 403, message: centreId ? 'Mock sessions are for centres whose licence runs' : 'Mock sessions are for teachers and learning centres' })
  }
  // A session needs credits to check anyone in: none left, none made.
  if (scopes.find(s => s.centreId === centreId)!.credits < 1) {
    throw createError({ statusCode: 402, message: 'No mock credits left: buy credits to make a session', data: { code: 'MOCK_CREDIT_REQUIRED' } })
  }
  const values = await sessionValues(body, false)
  const [row] = await useDb().insert(mockSessions).values({ ...values, centreId, ownerId: user.id } as typeof mockSessions.$inferInsert).returning()
  return row!
}

/** Whether anyone has begun: taken a seat, or handed a section in. */
async function hasStarted(sessionId: string) {
  const [row] = await useDb().select({ id: mockCandidates.id }).from(mockCandidates)
    .where(and(eq(mockCandidates.sessionId, sessionId), or(isNotNull(mockCandidates.seatedAt), sql`exists (select 1 from ${attempts} a where a.mock_candidate_id = ${mockCandidates.id})`))).limit(1)
  return !!row
}

/**
 * Deletes a session nobody has begun (no seat taken, nothing handed in). The credits spent on its
 * check-ins come back, and its walk-ins' accounts go with it.
 */
export async function deleteSession(session: Session, actorId: string) {
  if (await hasStarted(session.id)) throw conflict('Candidates have begun: archive it instead')
  const db = useDb()
  const list = await db.select({ userId: mockCandidates.userId, external: mockCandidates.external, checkedInAt: mockCandidates.checkedInAt }).from(mockCandidates)
    .where(eq(mockCandidates.sessionId, session.id))
  const refund = list.filter(c => c.checkedInAt).length
  await db.transaction(async (tx) => {
    if (refund) await tx.insert(mockCreditTransactions).values({ ...ownerOf(session), delta: refund, reason: 'REFUND', note: `Session deleted: ${session.title}`.slice(0, 200), createdById: actorId })
    await tx.delete(mockSessions).where(eq(mockSessions.id, session.id))
    const walkIns = list.filter(c => c.external).map(c => c.userId)
    if (walkIns.length) await tx.delete(users).where(and(inArray(users.id, walkIns), eq(users.mockOnly, true)))
  })
  return { deleted: true, refunded: refund }
}

/** The walk-ins' accounts of a centre's sessions (they go when the centre does). */
export async function walkInsOfCentre(centreId: string) {
  const rows = await useDb().select({ userId: mockCandidates.userId }).from(mockCandidates)
    .innerJoin(mockSessions, eq(mockSessions.id, mockCandidates.sessionId))
    .where(and(eq(mockSessions.centreId, centreId), eq(mockCandidates.external, true)))
  return rows.map(r => r.userId)
}

export async function updateSession(session: Session, body: SessionBody) {
  const values = await sessionValues(body, true)
  if (values.testId && values.testId !== session.testId) {
    const [started] = await useDb().select({ id: attempts.id }).from(attempts).innerJoin(mockCandidates, eq(mockCandidates.id, attempts.mockCandidateId))
      .where(eq(mockCandidates.sessionId, session.id)).limit(1)
    if (started) throw conflict('Candidates have started: the test stays')
  }
  if (!Object.keys(values).length) return session
  const [row] = await useDb().update(mockSessions).set({ ...values, updatedAt: new Date() }).where(eq(mockSessions.id, session.id)).returning()
  return row!
}

// ---------- candidates ----------

/** A walk-in: an account made only to sit this session (it signs in at the seat, nowhere else). */
export async function addWalkIn(session: Session, body: { fullName?: string, phone?: string, documentNo?: string, paidUzs?: number | null, paymentMethod?: string | null }) {
  const fullName = String(body.fullName ?? '').trim().slice(0, 120)
  if (!fullName) throw bad('Give the candidate\'s name')
  await roomLeft(session)
  const [test] = await useDb().select({ module: tests.module }).from(tests).where(eq(tests.id, session.testId)).limit(1)
  return useDb().transaction(async (tx) => {
    const [u] = await tx.insert(users).values({ name: fullName, mockOnly: true, onboarded: true, exam: examOfModule(test?.module) }).returning({ id: users.id })
    const paid = int(body.paidUzs, 0, 50_000_000)
    const [c] = await tx.insert(mockCandidates).values({
      sessionId: session.id, userId: u!.id, external: true, fullName,
      phone: String(body.phone ?? '').trim().slice(0, 30) || null,
      documentNo: String(body.documentNo ?? '').trim().slice(0, 30) || null,
      ...(paid ? { paidUzs: paid, paymentMethod: body.paymentMethod === 'CARD' ? 'CARD' : 'CASH', paidAt: new Date() } : {})
    }).returning()
    return c!
  })
}

/** The centre's own students, by their accounts: they sit as themselves and keep the results. */
export async function addStudents(session: Session, userIds: string[]) {
  if (!session.centreId) throw bad('A teacher\'s own session takes walk-ins')
  const ids = [...new Set(userIds.map(String))].slice(0, 200)
  if (!ids.length) throw bad('Pick the students')
  const rows = await useDb().select({ id: users.id, name: users.name, email: users.email }).from(centreMembers)
    .innerJoin(users, eq(users.id, centreMembers.userId))
    .where(and(eq(centreMembers.centreId, session.centreId), eq(centreMembers.role, 'STUDENT'), inArray(centreMembers.userId, ids)))
  if (rows.length !== ids.length) throw bad('Some of them are not students of this centre')
  await roomLeft(session, rows.length)
  const made = await useDb().insert(mockCandidates).values(rows.map(r => ({ sessionId: session.id, userId: r.id, fullName: r.name || r.email || 'Student' })))
    .onConflictDoNothing().returning({ id: mockCandidates.id })
  return { added: made.length }
}

/** The centre's students who are not in the session yet, for the add form. */
export async function studentsToAdd(session: Session) {
  if (!session.centreId) return []
  return useDb().select({ id: users.id, name: users.name, email: users.email }).from(centreMembers)
    .innerJoin(users, eq(users.id, centreMembers.userId))
    .where(and(eq(centreMembers.centreId, session.centreId), eq(centreMembers.role, 'STUDENT'),
      sql`not exists (select 1 from ${mockCandidates} c where c.session_id = ${session.id} and c.user_id = ${users.id})`))
    .orderBy(asc(users.name)).limit(500)
}

async function roomLeft(session: Session, adding = 1) {
  if (!session.capacity) return
  const [row] = await useDb().select({ n: sql<number>`count(*)::int` }).from(mockCandidates).where(eq(mockCandidates.sessionId, session.id))
  if ((row?.n ?? 0) + adding > session.capacity) throw conflict(`The room takes ${session.capacity}`)
}

async function candidateOf(session: Session, candidateId: string) {
  const [c] = await useDb().select().from(mockCandidates).where(and(eq(mockCandidates.id, candidateId), eq(mockCandidates.sessionId, session.id))).limit(1)
  if (!c) throw createError({ statusCode: 404, message: 'Candidate not found' })
  return c
}

/** Details fixed at the desk: name, phone, ID number, and the fee taken. */
export async function updateCandidate(session: Session, candidateId: string, body: { fullName?: string, phone?: string | null, documentNo?: string | null, paidUzs?: number | null, paymentMethod?: string | null }) {
  const c = await candidateOf(session, candidateId)
  const set: Partial<Candidate> = {}
  if (body.fullName !== undefined) {
    const name = String(body.fullName).trim().slice(0, 120)
    if (!name) throw bad('Give the candidate\'s name')
    set.fullName = name
  }
  if (body.phone !== undefined) set.phone = String(body.phone ?? '').trim().slice(0, 30) || null
  if (body.documentNo !== undefined) set.documentNo = String(body.documentNo ?? '').trim().slice(0, 30) || null
  if (body.paidUzs !== undefined) {
    const paid = int(body.paidUzs, 0, 50_000_000)
    Object.assign(set, paid ? { paidUzs: paid, paymentMethod: body.paymentMethod === 'CARD' ? 'CARD' : 'CASH', paidAt: c.paidAt ?? new Date() } : { paidUzs: null, paymentMethod: null, paidAt: null })
  }
  if (!Object.keys(set).length) return c
  const [row] = await useDb().update(mockCandidates).set(set).where(eq(mockCandidates.id, c.id)).returning()
  if (set.fullName && c.external) await useDb().update(users).set({ name: set.fullName }).where(eq(users.id, c.userId))
  return row!
}

/** Takes a candidate out before they sit anything; a credit spent on their check-in comes back. */
export async function removeCandidate(session: Session, candidateId: string, actorId: string) {
  const c = await candidateOf(session, candidateId)
  const db = useDb()
  const [sat] = await db.select({ id: attempts.id }).from(attempts).where(eq(attempts.mockCandidateId, c.id)).limit(1)
  if (sat) throw conflict('They have handed a section in: they stay')
  await db.transaction(async (tx) => {
    if (c.checkedInAt) await tx.insert(mockCreditTransactions).values({ ...ownerOf(session), delta: 1, reason: 'REFUND', note: c.fullName, createdById: actorId })
    if (c.seatSessionId) await tx.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, c.seatSessionId))
    await tx.delete(mockCandidates).where(eq(mockCandidates.id, c.id))
    if (c.external) await tx.delete(users).where(and(eq(users.id, c.userId), eq(users.mockOnly, true)))
  })
  return { removed: true }
}

const ownerOf = (session: Session) => (session.centreId ? { centreId: session.centreId, userId: null } : { centreId: null, userId: session.ownerId })

/** A six-digit code nobody waiting for a seat has, not starting with 0. */
async function freshCode() {
  for (let i = 0; i < 20; i++) {
    const code = String(randomInt(100000, 1000000))
    const [taken] = await useDb().select({ id: mockCandidates.id }).from(mockCandidates)
      .where(and(eq(mockCandidates.seatCode, code), isNull(mockCandidates.seatedAt))).limit(1)
    if (!taken) return code
  }
  throw createError({ statusCode: 503, message: 'No seat code free; try again' })
}

/**
 * The invigilator has seen the candidate's ID: a seat code. The first check-in spends a mock credit;
 * asked again (a computer failed, they moved seats) it gives a new code and ends the old seat.
 */
export async function checkIn(session: Session, candidateId: string, actorId: string) {
  if (session.status !== 'ACTIVE') throw conflict('This session is archived')
  if (Date.now() > session.closesAt.getTime()) throw conflict('This session has closed')
  const c = await candidateOf(session, candidateId)
  const code = await freshCode()
  const db = useDb()
  await db.transaction(async (tx) => {
    if (!c.checkedInAt) {
      // One credit for the candidate, from the centre's or the teacher's balance, never below nought.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${session.centreId ?? session.ownerId}))`)
      const left = await creditBalance(ownerOf(session), tx as unknown as Db)
      if (left < 1) throw createError({ statusCode: 402, message: 'No mock credits left: buy more to check candidates in', data: { code: 'MOCK_CREDIT_REQUIRED' } })
      await tx.insert(mockCreditTransactions).values({ ...ownerOf(session), delta: -1, reason: 'CHECK_IN', candidateId: c.id, createdById: actorId })
    }
    if (c.seatSessionId) await tx.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, c.seatSessionId))
    await tx.update(mockCandidates).set({ checkedInAt: c.checkedInAt ?? new Date(), seatCode: code, seatedAt: null, seatSessionId: null }).where(eq(mockCandidates.id, c.id))
  })
  return { code }
}

/** Opens (or closes) sections for the room, or for the candidates named. */
export async function unlock(session: Session, body: { skills?: string[], candidateIds?: string[], open?: boolean }) {
  const own = await skillsOfTest(session.testId)
  const skills = (body.skills ?? []).filter(s => (ONLINE_SKILLS as readonly string[]).includes(s) && own.includes(s))
  if (!skills.length) throw bad('Pick a section of this test')
  const open = body.open !== false
  const ids = body.candidateIds?.length ? body.candidateIds.map(String) : null
  const list = await useDb().select({ id: mockCandidates.id, unlockedSkills: mockCandidates.unlockedSkills }).from(mockCandidates)
    .where(and(eq(mockCandidates.sessionId, session.id), ids ? inArray(mockCandidates.id, ids) : undefined))
  for (const c of list) {
    const next = open ? [...new Set([...c.unlockedSkills, ...skills])] : c.unlockedSkills.filter(k => !skills.includes(k))
    await useDb().update(mockCandidates).set({ unlockedSkills: next }).where(eq(mockCandidates.id, c.id))
  }
  return { skills, open }
}

/** A mark given on the board: IELTS bands (0–9 in halves), Multilevel scores (0–75); null takes it back. */
export async function setMarks(session: Session, candidateId: string, body: { WRITING?: number | null, SPEAKING?: number | null }, exam: Exam) {
  const c = await candidateOf(session, candidateId)
  if (c.releasedAt) throw conflict('These results are announced')
  const marks = { ...(c.marks as Record<string, number | null>) }
  for (const skill of ['WRITING', 'SPEAKING'] as const) {
    if (!(skill in body)) continue
    const v = body[skill]
    if (v == null) {
      marks[skill] = null
      continue
    }
    const n = Number(v)
    if (exam === 'IELTS' ? !(n >= 0 && n <= 9 && Math.round(n * 2) === n * 2) : !(Number.isInteger(n) && n >= 0 && n <= 75)) {
      throw bad(exam === 'IELTS' ? 'A band is 0 to 9 in halves' : 'A score is 0 to 75')
    }
    marks[skill] = n
  }
  await useDb().update(mockCandidates).set({ marks }).where(eq(mockCandidates.id, c.id))
  return { marks }
}

// ---------- the board ----------

type SectionView = { status: 'LOCKED' | 'OPEN' | 'SITTING' | 'DONE' | 'FACE_TO_FACE', attemptId?: string, mark?: number | null, estimate?: number | null, correct?: number | null, total?: number | null, flags?: string[] | null, integrity?: any, given?: boolean }

/** Each candidate's sections, marks and result, as the board shows them (and the report, once announced). */
async function results(session: Session, list: Candidate[], exam: Exam, skills: string[]) {
  const ids = list.map(c => c.id)
  const rows = ids.length
    ? await useDb().select({
        id: attempts.id, candidateId: attempts.mockCandidateId, skill: attempts.skill, score: attempts.score, band: attempts.band,
        correct: attempts.correct, total: attempts.total, integrity: attempts.integrity, flags: attempts.integrityFlags,
        aiScore: aiReviews.score, aiBand: aiReviews.band, aiStatus: aiReviews.status
      }).from(attempts).leftJoin(aiReviews, eq(aiReviews.attemptId, attempts.id))
        .where(inArray(attempts.mockCandidateId, ids)).orderBy(asc(attempts.submittedAt))
    : []
  const ielts = exam === 'IELTS'
  return list.map((c) => {
    const marks = (c.marks ?? {}) as Record<string, number | null>
    const live = (c.live ?? null) as { skill?: string, signals?: any, at?: string } | null
    const sections: Record<string, SectionView> = {}
    for (const skill of skills) {
      if (skill === 'SPEAKING') {
        sections[skill] = { status: 'FACE_TO_FACE', mark: marks.SPEAKING ?? null, given: marks.SPEAKING != null }
        continue
      }
      const a = rows.find(r => r.candidateId === c.id && r.skill === skill)
      if (a) {
        const objective = skill !== 'WRITING'
        const estimate = skill === 'WRITING' ? (ielts ? a.aiBand : a.aiScore) ?? null : null
        const mark = objective ? (ielts ? a.band : a.score) : (marks.WRITING ?? estimate)
        sections[skill] = { status: 'DONE', attemptId: a.id, mark: mark ?? null, estimate, correct: a.correct, total: a.total, flags: a.flags, integrity: a.integrity, given: skill === 'WRITING' ? marks.WRITING != null : true }
      } else {
        const sitting = live?.skill === skill && c.unlockedSkills.includes(skill)
        sections[skill] = { status: sitting ? 'SITTING' : c.unlockedSkills.includes(skill) ? 'OPEN' : 'LOCKED' }
      }
    }
    const marked = skills.map(s => sections[s]?.mark ?? null)
    const complete = marked.every(m => m != null)
    const sum = marked.reduce<number>((a, b) => a + (b ?? 0), 0)
    // IELTS: the overall band; Multilevel: the mean of the skills' scores out of 75.
    const overall = !complete
      ? null
      : ielts
        ? (skills.length === 4 ? overallBand(marked) : roundToHalfBand(sum / skills.length))
        : Math.round(sum / skills.length)
    const liveFlags = live?.skill ? flagsOf(live.skill, cleanSignals(live.signals)) : []
    return {
      id: c.id, fullName: c.fullName, phone: c.phone, documentNo: c.documentNo, external: c.external,
      paidUzs: c.paidUzs, paymentMethod: c.paymentMethod, checkedInAt: c.checkedInAt,
      seatCode: c.seatedAt ? null : c.seatCode, seatedAt: c.seatedAt,
      unlockedSkills: c.unlockedSkills, live: live ? { ...live, flags: liveFlags } : null,
      sections, complete, overall, cefr: overall == null ? null : ielts ? bandCefr(overall) : cefrLevel(overall),
      releasedAt: c.releasedAt, reportToken: c.reportToken
    }
  })
}

/** The invigilator's board: the session, its test's sections, every candidate, and the credits left. */
export async function board(session: Session) {
  const db = useDb()
  const [[test], skills, list, credits, [centre]] = await Promise.all([
    db.select({ id: tests.id, slug: tests.slug, title: tests.title, module: tests.module }).from(tests).where(eq(tests.id, session.testId)).limit(1),
    skillsOfTest(session.testId),
    db.select().from(mockCandidates).where(eq(mockCandidates.sessionId, session.id)).orderBy(asc(mockCandidates.createdAt)),
    creditBalance(ownerOf(session)),
    session.centreId ? db.select({ name: centres.name }).from(centres).where(eq(centres.id, session.centreId)).limit(1) : Promise.resolve([])
  ])
  const exam = examOfModule(test?.module)
  const candidates = await results(session, list, exam, skills)
  return {
    session: { ...session, centreName: centre?.name ?? null },
    test: { ...test, exam },
    skills,
    credits,
    candidates,
    summary: {
      total: candidates.length,
      checkedIn: candidates.filter(c => c.checkedInAt).length,
      seated: candidates.filter(c => c.seatedAt).length,
      sitting: candidates.filter(c => Object.values(c.sections).some(s => s.status === 'SITTING')).length,
      complete: candidates.filter(c => c.complete).length,
      announced: candidates.filter(c => c.releasedAt).length,
      paidUzs: candidates.reduce((s, c) => s + (c.paidUzs ?? 0), 0)
    }
  }
}

/** Results announced: for the candidates named, or every one whose marks are complete. */
export async function release(session: Session, candidateIds?: string[]) {
  const b = await board(session)
  const chosen = b.candidates.filter(c => !c.releasedAt && c.complete && (!candidateIds?.length || candidateIds.includes(c.id)))
  for (const c of chosen) {
    await useDb().update(mockCandidates).set({ releasedAt: new Date(), reportToken: randomBytes(18).toString('base64url') }).where(eq(mockCandidates.id, c.id))
  }
  const waiting = b.candidates.filter(c => !c.releasedAt && !c.complete && (!candidateIds?.length || candidateIds.includes(c.id))).map(c => c.fullName)
  return { announced: chosen.length, waiting }
}

/** The results as a spreadsheet (CSV): one row a candidate. */
export async function resultsCsv(session: Session) {
  const b = await board(session)
  const head = ['Name', 'Phone', 'ID', 'Paid', ...b.skills.map(s => s[0] + s.slice(1).toLowerCase()), 'Overall', 'CEFR', 'Announced']
  const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows = b.candidates.map(c => [c.fullName, c.phone, c.documentNo, c.paidUzs, ...b.skills.map(s => c.sections[s]?.mark ?? ''), c.overall ?? '', c.cefr ?? '', c.releasedAt ? 'yes' : ''])
  return [head, ...rows].map(r => r.map(cell).join(',')).join('\r\n')
}

/** An announced result, opened from its link or QR code with no sign-in: the token is the key. */
export async function report(token: string) {
  const [c] = await useDb().select().from(mockCandidates).where(and(eq(mockCandidates.reportToken, token), isNotNull(mockCandidates.releasedAt))).limit(1)
  if (!c) throw createError({ statusCode: 404, message: 'Report not found' })
  const [s] = await useDb().select().from(mockSessions).where(eq(mockSessions.id, c.sessionId)).limit(1)
  const b = await board(s!)
  const mine = b.candidates.find(x => x.id === c.id)!
  const [owner] = await useDb().select({ name: users.name }).from(users).where(eq(users.id, s!.ownerId)).limit(1)
  return {
    name: c.fullName,
    held: { by: b.session.centreName ?? owner?.name ?? 'Mockmee', centre: !!b.session.centreName, title: s!.title, at: s!.opensAt, room: s!.room },
    test: { title: b.test.title, exam: b.test.exam, module: b.test.module },
    skills: b.skills,
    marks: Object.fromEntries(b.skills.map(k => [k, mine.sections[k]?.mark ?? null])),
    overall: mine.overall,
    cefr: mine.cefr,
    releasedAt: c.releasedAt
  }
}

// ---------- the seat ----------

const windowOpen = (s: Session, now = Date.now()) => s.status === 'ACTIVE' && now >= s.opensAt.getTime() - SEAT_EARLY_MS && now <= s.closesAt.getTime()

/**
 * A seat code typed at a room computer: once, after check-in, while the session runs. It signs the
 * candidate in (a walk-in's account signs in nowhere else); the seat keeps that sign-in's id so
 * leaving the seat, or a new check-in, ends it.
 */
export async function takeSeat(event: H3Event, code: string) {
  if (!/^\d{6}$/.test(code)) throw createError({ statusCode: 401, message: 'Wrong code, or it was used already' })
  const db = useDb()
  const [row] = await db.select({ c: mockCandidates, s: mockSessions }).from(mockCandidates)
    .innerJoin(mockSessions, eq(mockSessions.id, mockCandidates.sessionId))
    .where(and(eq(mockCandidates.seatCode, code), isNull(mockCandidates.seatedAt), isNotNull(mockCandidates.checkedInAt))).limit(1)
  if (!row) throw createError({ statusCode: 401, message: 'Wrong code, or it was used already' })
  if (!windowOpen(row.s)) throw conflict('This session has not opened yet, or has closed')
  // Two computers typing the same code at once: only one takes the seat.
  const taken = await db.update(mockCandidates).set({ seatedAt: new Date() })
    .where(and(eq(mockCandidates.id, row.c.id), isNull(mockCandidates.seatedAt))).returning({ id: mockCandidates.id })
  if (!taken.length) throw createError({ statusCode: 401, message: 'Wrong code, or it was used already' })
  const [user] = await db.select().from(users).where(eq(users.id, row.c.userId)).limit(1)
  const { sessionId } = await startSession(event, user!)
  await db.update(mockCandidates).set({ seatSessionId: sessionId }).where(eq(mockCandidates.id, row.c.id))
  return { name: row.c.fullName }
}

/** The seat this user is at now: checked in, seated, in a session still running (with an hour's grace to finish). */
export async function seatOf(userId: string) {
  const [row] = await useDb().select({ c: mockCandidates, s: mockSessions }).from(mockCandidates)
    .innerJoin(mockSessions, eq(mockSessions.id, mockCandidates.sessionId))
    .where(and(
      eq(mockCandidates.userId, userId), isNotNull(mockCandidates.seatedAt), isNotNull(mockCandidates.seatSessionId),
      eq(mockSessions.status, 'ACTIVE'), gt(mockSessions.closesAt, new Date(Date.now() - SEAT_EARLY_MS))
    ))
    .orderBy(desc(mockCandidates.seatedAt)).limit(1)
  return row ?? null
}

/** The seated candidate's screen: the sections, which are open, which are done; no marks while results are held. */
export async function mySeat(userId: string) {
  const seat = await seatOf(userId)
  if (!seat) throw createError({ statusCode: 404, message: 'No seat' })
  const db = useDb()
  const [[test], skills, done] = await Promise.all([
    db.select({ slug: tests.slug, title: tests.title, module: tests.module }).from(tests).where(eq(tests.id, seat.s.testId)).limit(1),
    skillsOfTest(seat.s.testId),
    db.select({ skill: attempts.skill }).from(attempts).where(eq(attempts.mockCandidateId, seat.c.id))
  ])
  const online = skills.filter(s => (ONLINE_SKILLS as readonly string[]).includes(s))
  return {
    name: seat.c.fullName,
    session: { title: seat.s.title, room: seat.s.room, closesAt: seat.s.closesAt },
    test: { slug: test!.slug, title: test!.title, exam: examOfModule(test!.module) },
    sections: online.map(skill => ({ skill, open: seat.c.unlockedSkills.includes(skill), done: done.some(d => d.skill === skill) })),
    speaking: skills.includes('SPEAKING'),
    finished: online.every(s => done.some(d => d.skill === s))
  }
}

/** The candidate is done at this computer: the seat's sign-in ends (the next candidate types their own code). */
export async function leaveSeat(event: H3Event, userId: string) {
  const seat = await seatOf(userId)
  if (seat?.c.seatSessionId) await useDb().update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, seat.c.seatSessionId))
  if (seat) await useDb().update(mockCandidates).set({ seatSessionId: null, live: null }).where(eq(mockCandidates.id, seat.c.id))
  clearAuthCookies(event)
  return { done: true }
}

/** What the exam page sees, sent as it goes: the section on screen and the integrity notes so far. */
export async function ping(userId: string, body: { skill?: string, signals?: unknown }) {
  const seat = await seatOf(userId)
  if (!seat) return { ok: false }
  const skill = (ONLINE_SKILLS as readonly string[]).includes(String(body.skill)) ? String(body.skill) : null
  await useDb().update(mockCandidates).set({ live: skill ? { skill, signals: cleanSignals(body.signals), at: new Date().toISOString() } : null }).where(eq(mockCandidates.id, seat.c.id))
  return { ok: true }
}

/**
 * The exam endpoints' gate. A user at a seat sitting their session's test: the section must be open
 * and not yet handed in, and whole (no single parts); it needs no Premium or marking credit. A
 * walk-in's account sits nothing else. Anyone else: null, and the usual rules apply.
 */
export async function seatGate(userId: string, testId: string, skill: string, partNumber: number | null) {
  const [[me], seat] = await Promise.all([
    useDb().select({ mockOnly: users.mockOnly }).from(users).where(eq(users.id, userId)).limit(1),
    seatOf(userId)
  ])
  if (!seat || seat.s.testId !== testId) {
    if (me?.mockOnly) throw createError({ statusCode: 403, message: 'This account sits its mock session only' })
    return null
  }
  if (partNumber) throw createError({ statusCode: 403, message: 'At a mock seat, sections are sat whole' })
  if (!seat.c.unlockedSkills.includes(skill)) throw createError({ statusCode: 403, message: 'Wait for the invigilator to open this section', data: { code: 'SECTION_LOCKED' } })
  const [done] = await useDb().select({ id: attempts.id }).from(attempts).where(and(eq(attempts.mockCandidateId, seat.c.id), eq(attempts.skill, skill))).limit(1)
  if (done) throw conflict('You have handed this section in')
  return seat.c
}

/** Whether a mock seat's attempt is still held from its candidate (the session holds results and theirs are not announced). */
export async function heldFrom(attemptId: string) {
  const [row] = await useDb().select({ hold: mockSessions.holdResults, releasedAt: mockCandidates.releasedAt }).from(attempts)
    .innerJoin(mockCandidates, eq(mockCandidates.id, attempts.mockCandidateId))
    .innerJoin(mockSessions, eq(mockSessions.id, mockCandidates.sessionId))
    .where(eq(attempts.id, attemptId)).limit(1)
  return !!row && row.hold && !row.releasedAt
}

/** Whether this user runs the session a mock seat's attempt was sat in (its centre's staff, or its teacher). */
export async function runsSessionOf(viewerId: string, candidateId: string | null) {
  if (!candidateId) return false
  const [row] = await useDb().execute(sql`
    select 1 from ${mockCandidates} c join ${mockSessions} s on s.id = c.session_id
    where c.id = ${candidateId} and (
      (s.centre_id is null and s.owner_id = ${viewerId})
      or exists (select 1 from ${centreMembers} m where m.centre_id = s.centre_id and m.user_id = ${viewerId} and m.role in ('OWNER', 'TEACHER'))
    ) limit 1`) as unknown as unknown[]
  return !!row
}

// ---------- credits, by an admin ----------

/** Mock credits sold to a centre or a teacher (or taken back, with a negative number). */
export async function grantCredits(adminId: string, body: { centreId?: string | null, userId?: string | null, credits?: number, note?: string }) {
  const n = Math.round(Number(body.credits))
  if (!Number.isFinite(n) || n === 0 || Math.abs(n) > 10_000) throw bad('Give a number of credits')
  if (!body.centreId === !body.userId) throw bad('Pick a centre or a teacher')
  const owner = body.centreId ? { centreId: String(body.centreId), userId: null } : { centreId: null, userId: String(body.userId) }
  if (n < 0 && (await creditBalance(owner)) + n < 0) throw conflict('That takes more than is left')
  await useDb().insert(mockCreditTransactions).values({ ...owner, delta: n, reason: 'GRANT', note: body.note?.trim().slice(0, 200) || null, createdById: adminId })
  return { credits: await creditBalance(owner) }
}
