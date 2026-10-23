import type { H3Event } from 'h3'
import type { SQL } from 'drizzle-orm'
import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import { attempts, centreMembers, centres, users } from '../database/schema'
import { licenceOpen } from './centres'

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
