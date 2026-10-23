import type { H3Event } from 'h3'
import type { SQL } from 'drizzle-orm'
import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import { attempts, centreMembers, centres, users } from '../database/schema'
import { licenceOpen } from './centres'
import { notifyTelegram } from './notify'
import { MSG } from './messages'
import { sendPush } from './firebase'

/**
 * Who marks Writing and Speaking handed in for practice (a mock session's scripts are marked on its
 * board, mock-sessions.ts):
 * - a student of a learning centre (one whose licence runs): that centre's owner and teachers;
 * - anyone else: Mockmee's markers (users an admin switched marking on for) and admins;
 * - admins may mark everything.
 * Nobody but an admin marks their own script.
 */
export interface MarkingScope { userId: string, all: boolean, pool: boolean, centreIds: string[] }

export async function markingScopeOf(user: { id: string, role: string }): Promise<MarkingScope> {
  const db = useDb()
  const [[me], rows] = await Promise.all([
    db.select({ marker: users.marker, mockOnly: users.mockOnly }).from(users).where(eq(users.id, user.id)).limit(1),
    db.select({ id: centres.id, active: centres.active, licensedUntil: centres.licensedUntil }).from(centreMembers)
      .innerJoin(centres, eq(centres.id, centreMembers.centreId))
      .where(and(eq(centreMembers.userId, user.id), inArray(centreMembers.role, ['OWNER', 'TEACHER'])))
  ])
  if (!me || me.mockOnly) return { userId: user.id, all: false, pool: false, centreIds: [] }
  const all = user.role === 'admin'
  return { userId: user.id, all, pool: all || me.marker, centreIds: rows.filter(r => licenceOpen(r)).map(r => r.id) }
}

export const marksAnything = (s: MarkingScope) => s.all || s.pool || s.centreIds.length > 0

/** The user, and what they may mark; 403 for someone who marks nothing. */
export async function requireMarker(event: H3Event) {
  const user = await requireUser(event)
  const scope = await markingScopeOf(user)
  if (!marksAnything(scope)) throw createError({ statusCode: 403, message: 'Marking is not open to you' })
  return { user, scope }
}

/** The attempt's candidate studies at a centre whose licence runs (any of `centreIds`, when given). */
function inCentre(centreIds?: string[]) {
  return sql`exists (select 1 from ${centreMembers} m join ${centres} c on c.id = m.centre_id
    where m.user_id = ${attempts.userId} and m.role = 'STUDENT' and c.active and c.licensed_until > now()
    ${centreIds ? sql`and m.centre_id in (${sql.join(centreIds.map(id => sql`${id}`), sql`, `)})` : sql``})`
}

/**
 * The Writing and Speaking attempts this scope marks (a mock session's are never in it). `from` narrows
 * an admin's queue: POOL (students outside a centre) or CENTRES (centre students).
 */
export function markableWhere(scope: MarkingScope, from?: 'POOL' | 'CENTRES'): SQL {
  const base = and(inArray(attempts.skill, ['WRITING', 'SPEAKING']), sql`${attempts.mockCandidateId} is null`)!
  if (scope.all) return and(base, from === 'POOL' ? sql`not ${inCentre()}` : from === 'CENTRES' ? inCentre() : undefined)!
  const reach: SQL[] = []
  if (scope.pool) reach.push(sql`not ${inCentre()}`)
  if (scope.centreIds.length) reach.push(inCentre(scope.centreIds))
  return and(base, ne(attempts.userId, scope.userId), sql`(${sql.join(reach, sql` or `)})`)!
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

/** The centre each candidate studies at (licence running), for the queue. */
export async function centreOfStudents(userIds: string[]) {
  if (!userIds.length) return new Map<string, string>()
  const rows = await useDb().select({ userId: centreMembers.userId, name: centres.name, active: centres.active, licensedUntil: centres.licensedUntil }).from(centreMembers)
    .innerJoin(centres, eq(centres.id, centreMembers.centreId))
    .where(and(inArray(centreMembers.userId, userIds), eq(centreMembers.role, 'STUDENT')))
  return new Map(rows.filter(r => licenceOpen(r)).map(r => [r.userId, r.name]))
}

/** Whether the user studies at a centre whose licence runs: their teachers mark their Writing and Speaking, free. */
export async function studiesAtCentre(userId: string) {
  const [row] = await useDb().select({ one: sql<number>`1` }).from(centreMembers)
    .innerJoin(centres, eq(centres.id, centreMembers.centreId))
    .where(and(eq(centreMembers.userId, userId), eq(centreMembers.role, 'STUDENT'), eq(centres.active, true), sql`${centres.licensedUntil} > now()`)).limit(1)
  return !!row
}

/** The owners and teachers of the centres (licence running) where the student studies. */
async function teachersOf(studentId: string) {
  const rows = await useDb().execute(sql`
    select distinct t.user_id as id from centre_members s
    join centres c on c.id = s.centre_id and c.active and c.licensed_until > now()
    join centre_members t on t.centre_id = s.centre_id and t.role in ('OWNER', 'TEACHER')
    where s.user_id = ${studentId} and s.role = 'STUDENT' and t.user_id <> ${studentId}`) as unknown as { id: string }[]
  return rows.map(r => r.id)
}

/** A centre student handed in Writing or Speaking: their teachers hear of it (Telegram and push). */
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
 * Every hour: centre students' scripts that have waited over two days get their teachers one reminder
 * (each script once), counted per teacher.
 */
export async function sendMarkingReminders() {
  const db = useDb()
  const due = await db.select({ id: attempts.id, userId: attempts.userId }).from(attempts)
    .where(and(eq(attempts.status, 'SUBMITTED'), inArray(attempts.skill, ['WRITING', 'SPEAKING']), sql`${attempts.mockCandidateId} is null`,
      sql`${attempts.markRemindedAt} is null`, sql`${attempts.submittedAt} < now() - interval '48 hours'`, inCentre()))
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
