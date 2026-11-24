import type { H3Event } from 'h3'
import type { SQL } from 'drizzle-orm'
import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import { attempts, classGroups, classMembers, users } from '../database/schema'
import { notifyTelegram } from './notify'
import { MSG } from './messages'
import { sendPush } from './firebase'

/**
 * Who marks Writing and Speaking handed in for practice (a mock session's scripts are marked on its
 * board, mock-sessions.ts):
 * - a student in a teacher's class: that teacher (any of their teachers, if they are in several classes);
 * - admins may mark everything.
 * Nobody but an admin marks their own script. A student in no class gets the AI check only.
 */
export interface MarkingScope { userId: string, all: boolean, teacher: boolean }

export async function markingScopeOf(user: { id: string, role: string }): Promise<MarkingScope> {
  const [me] = await useDb().select({ mockOnly: users.mockOnly }).from(users).where(eq(users.id, user.id)).limit(1)
  if (!me || me.mockOnly) return { userId: user.id, all: false, teacher: false }
  return { userId: user.id, all: user.role === 'admin', teacher: await hasClasses(user.id) }
}

export const marksAnything = (s: MarkingScope) => s.all || s.teacher

/** The user, and what they may mark; 403 for someone who marks nothing. */
export async function requireMarker(event: H3Event) {
  const user = await requireUser(event)
  const scope = await markingScopeOf(user)
  if (!marksAnything(scope)) throw createError({ statusCode: 403, message: 'Marking is not open to you' })
  return { user, scope }
}

/** The attempt's candidate is in a class (of `teacherId`, when given). */
function inClass(teacherId?: string) {
  return sql`exists (select 1 from ${classMembers} m join ${classGroups} g on g.id = m.group_id
    where m.user_id = ${attempts.userId} and g.teacher_id <> ${attempts.userId}
    ${teacherId ? sql`and g.teacher_id = ${teacherId}` : sql``})`
}

/**
 * The Writing and Speaking attempts this scope marks (a mock session's are never in it). `from` narrows
 * an admin's queue: CLASSES (students in a teacher's class) or OUTSIDE (the rest).
 */
export function markableWhere(scope: MarkingScope, from?: 'CLASSES' | 'OUTSIDE'): SQL {
  const base = and(inArray(attempts.skill, ['WRITING', 'SPEAKING']), sql`${attempts.mockCandidateId} is null`)!
  if (scope.all) return and(base, from === 'CLASSES' ? inClass() : from === 'OUTSIDE' ? sql`not ${inClass()}` : undefined)!
  if (!scope.teacher) return sql`false`
  return and(base, ne(attempts.userId, scope.userId), inClass(scope.userId))!
}

/** 404 unless this scope marks the attempt. */
export async function requireMarkable(scope: MarkingScope, attemptId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) throw createError({ statusCode: 404, message: 'Attempt not found' })
  const [row] = await useDb().select({ id: attempts.id }).from(attempts).where(and(eq(attempts.id, attemptId), markableWhere(scope))).limit(1)
  if (!row) throw createError({ statusCode: 404, message: 'Attempt not found' })
}

/** Whether this user may mark the attempt (the AI draft routes ask). */
export async function marksAttempt(user: { id: string, role: string }, attemptId: string) {
  const scope = await markingScopeOf(user)
  if (!marksAnything(scope)) return false
  return requireMarkable(scope, attemptId).then(() => true, () => false)
}

/** The class each candidate is in (one name; a teacher sees only their own classes), for the queue. */
export async function classOfStudents(userIds: string[], teacherId?: string) {
  if (!userIds.length) return new Map<string, string>()
  const rows = await useDb().select({ userId: classMembers.userId, name: classGroups.name }).from(classMembers)
    .innerJoin(classGroups, eq(classGroups.id, classMembers.groupId))
    .where(and(inArray(classMembers.userId, userIds), teacherId ? eq(classGroups.teacherId, teacherId) : undefined))
  return new Map(rows.map(r => [r.userId, r.name]))
}

/** A student in a class handed in Writing or Speaking: their teachers hear of it (Telegram and push). */
export async function tellTeachersToMark(attempt: { id: string, userId: string, skill: string }) {
  const teacherIds = await teachersOf(attempt.userId)
  if (!teacherIds.length) return
  const [u] = await useDb().select({ name: users.name, email: users.email }).from(users).where(eq(users.id, attempt.userId)).limit(1)
  const name = u?.name || u?.email || 'A student'
  const path = `/marking/${attempt.id}`
  await Promise.all(teacherIds.map(id => notifyTelegram(id, l => ({ text: MSG.toMark(l, name, attempt.skill), path, button: MSG.toMarkButton[l] }))))
  await sendPush(teacherIds, { title: 'New script to mark', body: `${name} handed in ${attempt.skill === 'WRITING' ? 'Writing' : 'Speaking'}.`, data: { url: path } }).catch(() => {})
}

/**
 * Every hour: class students' scripts that have waited over two days get their teachers one reminder
 * (each script once), counted per teacher.
 */
export async function sendMarkingReminders() {
  const db = useDb()
  const due = await db.select({ id: attempts.id, userId: attempts.userId }).from(attempts)
    .where(and(eq(attempts.status, 'SUBMITTED'), inArray(attempts.skill, ['WRITING', 'SPEAKING']), sql`${attempts.mockCandidateId} is null`,
      sql`${attempts.markRemindedAt} is null`, sql`${attempts.submittedAt} < now() - interval '48 hours'`, inClass()))
    .limit(500)
  if (!due.length) return { scripts: 0, teachers: 0 }
  const waiting = new Map<string, number>()
  for (const a of due) for (const t of await teachersOf(a.userId)) waiting.set(t, (waiting.get(t) ?? 0) + 1)
  await db.update(attempts).set({ markRemindedAt: new Date() }).where(inArray(attempts.id, due.map(a => a.id)))
  for (const [teacherId, n] of waiting) {
    await notifyTelegram(teacherId, l => ({ text: MSG.toMarkWaiting(l, n), path: '/marking', button: MSG.toMarkButton[l] })).catch(() => {})
  }
  await sendPush([...waiting.keys()], { title: 'Scripts waiting', body: 'Some of your students\' scripts have waited over two days for a mark.', data: { url: '/marking' } }).catch(() => {})
  return { scripts: due.length, teachers: waiting.size }
}
