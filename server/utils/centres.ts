import type { H3Event } from 'h3'
import { randomBytes } from 'node:crypto'
import { and, count, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm'
import { attempts, centreMembers, centres, classGroups, classMembers, tests, users } from '../database/schema'

/**
 * Learning centres: a centre's owner and teachers run groups that students join with a code. Each
 * student takes one of the centre's seats and has Premium while the licence runs. Teachers see their
 * students' results and set assignments: a section of a test, done when a member hands it in after
 * it was set.
 */

type Db = ReturnType<typeof useDb>
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
export type CentreRole = 'OWNER' | 'TEACHER' | 'STUDENT'
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const newCode = (length = 8) => Array.from(randomBytes(length), b => CODE_CHARS[b % CODE_CHARS.length]).join('')

/** The roles in order: a role is only ever raised by joining a centre, never lowered. */
export const ROLE_RANK: Record<string, number> = { student: 0, teacher: 1, center_owner: 2, admin: 3 }

/** Raises a user's role to `role` when it is lower (a centre's owner becomes center_owner, its teachers teacher). */
export async function raiseRole(db: Db | Tx, userId: string, role: 'teacher' | 'center_owner') {
  const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1)
  if (u && (ROLE_RANK[u.role] ?? 0) < ROLE_RANK[role]!) await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId))
}

export const licenceOpen = (c: { active: boolean, licensedUntil: Date | null }, now = new Date()) => c.active && !!c.licensedUntil && c.licensedUntil > now

/** Whether a user sits in a centre whose licence runs (as a student, teacher or owner): that gives Premium. */
export async function hasCentreSeat(userId: string, db: Db | Tx = useDb()) {
  const [row] = await db.select({ one: sql<number>`1` }).from(centreMembers)
    .innerJoin(centres, eq(centres.id, centreMembers.centreId))
    .where(and(eq(centreMembers.userId, userId), eq(centres.active, true), sql`${centres.licensedUntil} > now()`)).limit(1)
  return !!row
}

/** The centres a user belongs to, with their role in each. */
export async function centresOf(userId: string) {
  return useDb().select({ id: centres.id, name: centres.name, role: centreMembers.role }).from(centreMembers)
    .innerJoin(centres, eq(centres.id, centreMembers.centreId)).where(eq(centreMembers.userId, userId))
}

/** The caller as the owner or a teacher of this centre (admins may look at any centre). */
export async function requireCentreStaff(event: H3Event, centreId: string) {
  const user = await requireUser(event)
  const [c] = await useDb().select().from(centres).where(eq(centres.id, centreId)).limit(1)
  if (!c) throw createError({ statusCode: 404, message: 'Centre not found' })
  if (user.role === 'admin') return { user, centre: c, role: 'OWNER' as CentreRole }
  const [m] = await useDb().select({ role: centreMembers.role }).from(centreMembers)
    .where(and(eq(centreMembers.centreId, centreId), eq(centreMembers.userId, user.id))).limit(1)
  if (!m || m.role === 'STUDENT') throw createError({ statusCode: 404, message: 'Centre not found' })
  return { user, centre: c, role: m.role as CentreRole }
}

/** A group, for the owner or a teacher of its centre. */
export async function requireGroupStaff(event: H3Event, groupId: string) {
  const [g] = await useDb().select().from(classGroups).where(eq(classGroups.id, groupId)).limit(1)
  if (!g) throw createError({ statusCode: 404, message: 'Group not found' })
  return { ...(await requireCentreStaff(event, g.centreId)), group: g }
}

/** Whether a viewer teaches at a centre where this user is a student: then they may see the user's results. */
export async function teachesStudent(viewerId: string, studentId: string) {
  const [row] = await useDb().execute(sql`
    select 1 from centre_members t join centre_members s on s.centre_id = t.centre_id
    where t.user_id = ${viewerId} and t.role in ('OWNER', 'TEACHER') and s.user_id = ${studentId} and s.role = 'STUDENT' limit 1`) as unknown as unknown[]
  return !!row
}

export async function studentsInCentre(centreId: string, db: Db | Tx = useDb()) {
  const [row] = await db.select({ n: count() }).from(centreMembers).where(and(eq(centreMembers.centreId, centreId), eq(centreMembers.role, 'STUDENT')))
  return row?.n ?? 0
}

/** Joins a group by its code: a seat in the centre (if they have none there yet), then the group. */
export async function joinGroup(userId: string, code: string) {
  const db = useDb()
  return db.transaction(async (tx) => {
    const [g] = await tx.select().from(classGroups).where(and(eq(classGroups.joinCode, code.trim().toUpperCase()), eq(classGroups.archived, false))).limit(1)
    if (!g) throw createError({ statusCode: 404, message: 'No class has that code. Check it with your teacher.' })
    await tx.execute(sql`select 1 from ${centres} where ${centres.id} = ${g.centreId} for update`)
    const [c] = await tx.select().from(centres).where(eq(centres.id, g.centreId)).limit(1)
    if (!c || !licenceOpen(c)) throw createError({ statusCode: 409, message: 'This centre\'s licence has ended. Ask your teacher.' })
    const [member] = await tx.select({ role: centreMembers.role }).from(centreMembers)
      .where(and(eq(centreMembers.centreId, c.id), eq(centreMembers.userId, userId))).limit(1)
    if (!member) {
      if ((await studentsInCentre(c.id, tx)) >= c.seats) throw createError({ statusCode: 409, message: 'The centre has no free seats. Ask your teacher.' })
      await tx.insert(centreMembers).values({ centreId: c.id, userId, role: 'STUDENT' })
    }
    await tx.insert(classMembers).values({ groupId: g.id, userId }).onConflictDoNothing()
    return { group: { id: g.id, name: g.name }, centre: { id: c.id, name: c.name } }
  })
}

/** Takes a student out of a group; out of the centre too (freeing the seat) when no other group of it has them. */
export async function leaveGroup(groupId: string, userId: string) {
  const db = useDb()
  await db.transaction(async (tx) => {
    const [g] = await tx.select({ centreId: classGroups.centreId }).from(classGroups).where(eq(classGroups.id, groupId)).limit(1)
    if (!g) return
    await tx.delete(classMembers).where(and(eq(classMembers.groupId, groupId), eq(classMembers.userId, userId)))
    const [other] = await tx.select({ one: sql<number>`1` }).from(classMembers).innerJoin(classGroups, eq(classGroups.id, classMembers.groupId))
      .where(and(eq(classMembers.userId, userId), eq(classGroups.centreId, g.centreId))).limit(1)
    if (!other) await tx.delete(centreMembers).where(and(eq(centreMembers.centreId, g.centreId), eq(centreMembers.userId, userId), eq(centreMembers.role, 'STUDENT')))
  })
}

const SKILLS = ['LISTENING', 'READING', 'WRITING', 'SPEAKING']
const nameOf = (u: { name: string | null, telegramUsername: string | null, email: string | null }) => u.name || (u.telegramUsername ? `@${u.telegramUsername}` : u.email) || 'Student'

/** A group's students with where each stands: the average of their last three whole sections per skill. */
export async function groupStudents(groupId: string) {
  const db = useDb()
  const members = await db.select({ id: users.id, name: users.name, telegramUsername: users.telegramUsername, email: users.email, avatarUrl: users.avatarUrl, joinedAt: classMembers.joinedAt })
    .from(classMembers).innerJoin(users, eq(users.id, classMembers.userId)).where(eq(classMembers.groupId, groupId)).orderBy(users.name)
  if (!members.length) return []
  const rows = await db.select({ userId: attempts.userId, skill: attempts.skill, score: attempts.score, band: attempts.band, partNumber: attempts.partNumber, at: attempts.submittedAt })
    .from(attempts).where(inArray(attempts.userId, members.map(m => m.id))).orderBy(desc(attempts.submittedAt)).limit(5000)
  return members.map((m) => {
    const mine = rows.filter(r => r.userId === m.id)
    // In the exam of their latest section: IELTS as a band (to one decimal), Multilevel out of 75.
    const bands: string[] = []
    const level = Object.fromEntries(SKILLS.map((s) => {
      const whole = mine.filter(r => r.skill === s && r.partNumber == null && (r.score != null || r.band != null))
      const inBands = whole[0]?.score == null && whole[0]?.band != null
      if (inBands) bands.push(s)
      const last = whole.map(r => (inBands ? r.band : r.score)).filter((v): v is number => v != null).slice(0, 3)
      if (!last.length) return [s, null]
      const mean = last.reduce((a, v) => a + v, 0) / last.length
      return [s, inBands ? Math.round(mean * 10) / 10 : Math.round(mean)]
    }))
    return { id: m.id, name: nameOf(m), avatarUrl: m.avatarUrl, joinedAt: m.joinedAt, attempts: mine.length, lastActive: mine[0]?.at ?? null, level, bands }
  })
}

type Assignment = { id: string, groupId: string, testId: string, skill: string, partNumber: number | null, createdAt: Date }

/** Each member's first hand-in of an assignment since it was set (the same section, or the same part). */
export async function assignmentHandIns(a: Assignment, memberIds: string[]) {
  if (!memberIds.length) return new Map<string, { attemptId: string, score: number | null, band: number | null, status: string, at: Date }>()
  const rows = await useDb().select({ id: attempts.id, userId: attempts.userId, score: attempts.score, band: attempts.band, status: attempts.status, at: attempts.submittedAt })
    .from(attempts).where(and(
      inArray(attempts.userId, memberIds), eq(attempts.testId, a.testId), eq(attempts.skill, a.skill),
      a.partNumber == null ? isNull(attempts.partNumber) : eq(attempts.partNumber, a.partNumber),
      gte(attempts.submittedAt, a.createdAt)
    )).orderBy(attempts.submittedAt)
  const first = new Map<string, { attemptId: string, score: number | null, band: number | null, status: string, at: Date }>()
  for (const r of rows) if (!first.has(r.userId)) first.set(r.userId, { attemptId: r.id, score: r.score, band: r.band, status: r.status, at: r.at })
  return first
}

/** An assignment as lists show it: what to sit, where, and how many have done it. */
export async function assignmentView(a: Assignment & { note: string | null, dueAt: Date | null }, memberIds: string[]) {
  const [[t], done] = await Promise.all([
    useDb().select({ slug: tests.slug, title: tests.title, module: tests.module }).from(tests).where(eq(tests.id, a.testId)).limit(1),
    assignmentHandIns(a, memberIds)
  ])
  // An IELTS test is marked in bands (its average to one decimal), a Multilevel one out of 75.
  const exam = examOfTest(t)
  const ielts = exam === 'IELTS'
  const scores = [...done.values()].map(d => (ielts ? d.band : d.score)).filter((s): s is number => s != null)
  const mean = scores.length ? scores.reduce((x, y) => x + y, 0) / scores.length : null
  return {
    id: a.id, skill: a.skill, partNumber: a.partNumber, note: a.note, dueAt: a.dueAt, createdAt: a.createdAt,
    test: t ? { slug: t.slug, title: t.title } : null,
    to: t ? `/tests/${t.slug}/${a.skill.toLowerCase()}${a.partNumber ? `?part=${a.partNumber}` : ''}` : null,
    exam, done: done.size, of: memberIds.length,
    average: mean == null ? null : ielts ? Math.round(mean * 10) / 10 : Math.round(mean)
  }
}
