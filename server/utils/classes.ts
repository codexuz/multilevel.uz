import type { H3Event } from 'h3'
import { randomBytes } from 'node:crypto'
import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm'
import { attempts, classGroups, classMembers, tests, users } from '../database/schema'

/**
 * Teachers' classes: a teacher makes a class (/teach, /classes) and shares its join link; students
 * join with it. The teacher sets work (assignments: a section of a test, done when a member hands it
 * in after it was set), sees each student's results, and marks their Writing and Speaking. Classes
 * are free and have no limit on students. Making a class makes the user a teacher.
 */

type Db = ReturnType<typeof useDb>
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const newCode = (length = 8) => Array.from(randomBytes(length), b => CODE_CHARS[b % CODE_CHARS.length]).join('')

/** The roles in order: a role is only ever raised (by making a class), never lowered. */
export const ROLE_RANK: Record<string, number> = { student: 0, teacher: 1, center_owner: 1, admin: 3 }

/** Makes the user a teacher, unless they are one already (or an admin). */
export async function raiseToTeacher(db: Db | Tx, userId: string) {
  const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1)
  if (u && (ROLE_RANK[u.role] ?? 0) < ROLE_RANK.teacher!) await db.update(users).set({ role: 'teacher', updatedAt: new Date() }).where(eq(users.id, userId))
}

/** Whether the user has any class of their own (archived or not). */
export async function hasClasses(userId: string, db: Db | Tx = useDb()) {
  const [row] = await db.select({ one: sql<number>`1` }).from(classGroups).where(eq(classGroups.teacherId, userId)).limit(1)
  return !!row
}

/** A class, for its teacher (admins may look at any). */
export async function requireClassTeacher(event: H3Event, groupId: string) {
  const user = await requireUser(event)
  if (!/^[0-9a-f-]{36}$/i.test(groupId)) throw createError({ statusCode: 404, message: 'Class not found' })
  const [g] = await useDb().select().from(classGroups).where(eq(classGroups.id, groupId)).limit(1)
  if (!g || (g.teacherId !== user.id && user.role !== 'admin')) throw createError({ statusCode: 404, message: 'Class not found' })
  return { user, group: g }
}

/** Whether a viewer teaches a class this user is in: then they may see the user's results and mark their work. */
export async function teachesStudent(viewerId: string, studentId: string) {
  if (viewerId === studentId) return false
  const [row] = await useDb().select({ one: sql<number>`1` }).from(classMembers)
    .innerJoin(classGroups, eq(classGroups.id, classMembers.groupId))
    .where(and(eq(classMembers.userId, studentId), eq(classGroups.teacherId, viewerId))).limit(1)
  return !!row
}

/** The teachers of the classes a student is in (not archived; not the student themselves). */
export async function teachersOf(studentId: string) {
  const rows = await useDb().selectDistinct({ id: classGroups.teacherId }).from(classMembers)
    .innerJoin(classGroups, eq(classGroups.id, classMembers.groupId))
    .where(and(eq(classMembers.userId, studentId), eq(classGroups.archived, false), sql`${classGroups.teacherId} <> ${studentId}`))
  return rows.map(r => r.id)
}

/** Whether the student is in a teacher's class (not archived): that teacher marks their Writing and Speaking. */
export async function inAClass(userId: string) {
  const [row] = await useDb().select({ one: sql<number>`1` }).from(classMembers)
    .innerJoin(classGroups, eq(classGroups.id, classMembers.groupId))
    .where(and(eq(classMembers.userId, userId), eq(classGroups.archived, false), sql`${classGroups.teacherId} <> ${userId}`)).limit(1)
  return !!row
}

/** The classes a student is in, with their teachers' names (for the student's own pages). */
export async function classesOfStudent(userId: string) {
  const rows = await useDb().select({ id: classGroups.id, name: classGroups.name, teacher: users.name, teacherHandle: users.telegramUsername })
    .from(classMembers).innerJoin(classGroups, eq(classGroups.id, classMembers.groupId)).innerJoin(users, eq(users.id, classGroups.teacherId))
    .where(and(eq(classMembers.userId, userId), eq(classGroups.archived, false)))
  return rows.map(r => ({ id: r.id, name: r.name, teacher: r.teacher || (r.teacherHandle ? `@${r.teacherHandle}` : 'Teacher') }))
}

/** A teacher's classes, newest first, with how many students and assignments each has. */
export async function classesOfTeacher(teacherId: string) {
  const rows = await useDb().select({
    g: classGroups,
    students: sql<number>`(select count(*)::int from class_members m where m.group_id = ${classGroups.id})`,
    assignments: sql<number>`(select count(*)::int from assignments a where a.group_id = ${classGroups.id})`
  }).from(classGroups).where(eq(classGroups.teacherId, teacherId)).orderBy(classGroups.archived, desc(classGroups.createdAt))
  return rows.map(r => ({
    id: r.g.id, name: r.g.name, exam: r.g.exam, level: r.g.level, description: r.g.description, joinCode: r.g.joinCode,
    archived: r.g.archived, createdAt: r.g.createdAt, students: r.students, assignments: r.assignments
  }))
}

/** A new class for this user, who becomes a teacher. Walk-in accounts of mock sessions cannot. */
export async function createClass(userId: string, name: string, opts?: { exam?: string | null, level?: string | null, description?: string | null }) {
  const title = name.trim().slice(0, 80)
  if (!title) throw createError({ statusCode: 400, message: 'Give the class a name' })
  const exam = opts?.exam === 'IELTS' ? 'IELTS' : 'MULTILEVEL'
  const level = opts?.level ? String(opts.level).trim().slice(0, 24) || null : null
  const description = opts?.description ? String(opts.description).trim().slice(0, 300) || null : null
  return useDb().transaction(async (tx) => {
    const [u] = await tx.select({ mockOnly: users.mockOnly }).from(users).where(eq(users.id, userId)).limit(1)
    if (!u || u.mockOnly) throw createError({ statusCode: 403, message: 'This account cannot have classes' })
    await raiseToTeacher(tx, userId)
    const [g] = await tx.insert(classGroups).values({ name: title, exam, level, description, teacherId: userId, joinCode: newCode() }).returning()
    return g!
  })
}

/** Joins a class by its code. A teacher cannot join their own class. */
export async function joinClass(userId: string, code: string) {
  const db = useDb()
  const [g] = await db.select().from(classGroups).where(and(eq(classGroups.joinCode, code.trim().toUpperCase()), eq(classGroups.archived, false))).limit(1)
  if (!g) throw createError({ statusCode: 404, message: 'No class has that code. Check it with your teacher.' })
  if (g.teacherId === userId) throw createError({ statusCode: 400, message: 'This is your own class: share its link with your students.' })
  const [u] = await db.select({ mockOnly: users.mockOnly }).from(users).where(eq(users.id, userId)).limit(1)
  if (!u || u.mockOnly) throw createError({ statusCode: 403, message: 'This account cannot join classes' })
  await db.insert(classMembers).values({ groupId: g.id, userId }).onConflictDoNothing()
  return { group: { id: g.id, name: g.name } }
}

/** Takes a student out of a class. */
export async function leaveClass(groupId: string, userId: string) {
  await useDb().delete(classMembers).where(and(eq(classMembers.groupId, groupId), eq(classMembers.userId, userId)))
}

const SKILLS = ['LISTENING', 'READING', 'WRITING', 'SPEAKING']
const nameOf = (u: { name: string | null, telegramUsername: string | null, email: string | null }) => u.name || (u.telegramUsername ? `@${u.telegramUsername}` : u.email) || 'Student'

/** A class's students with where each stands: the average of their last three whole sections per skill. */
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
