import { and, desc, eq, inArray } from 'drizzle-orm'
import {
  assignments, classGroups, classMembers, mockCandidates, mockSessions, parts, questionGroups,
  speakingParts, testGroups, testStudents, tests, users, writingTasks
} from '../database/schema'
import type { AuthUser } from './auth'

/**
 * Isolation and audience rules for teacher-created tests:
 * - Admin: full access to platform tests + all teacher tests.
 * - Teacher: can create and manage ONLY their own private tests & library items (`teacherId = user.id`).
 * - Student: can view/sit PUBLIC published tests + PRIVATE published tests shared with their classes
 *   (`test_groups`), shared directly with them (`test_students`), assigned via `assignments`, or via
 *   a `mock_sessions` seat.
 * - Guest / SEO: PUBLIC published tests only.
 */

export const isAdminUser = (user: Pick<AuthUser, 'role'> | null | undefined): boolean => user?.role === 'admin'

/** For library queries: null for admin (unrestricted), user.id for teachers (own items only). */
export const ownerIdFor = (user: AuthUser): string | null => (isAdminUser(user) ? null : user.id)

export async function assertCanManageTest(user: AuthUser, testId: string) {
  const [row] = await useDb()
    .select({ id: tests.id, teacherId: tests.teacherId, visibility: tests.visibility })
    .from(tests)
    .where(eq(tests.id, testId))
    .limit(1)
  if (!row) throw createError({ statusCode: 404, message: 'Test not found' })
  if (!isAdminUser(user) && row.teacherId !== user.id) {
    throw createError({ statusCode: 403, message: 'You can only edit your own tests' })
  }
  return row
}

export async function assertCanManagePart(user: AuthUser, partId: string) {
  const [row] = await useDb()
    .select({ id: parts.id, teacherId: parts.teacherId })
    .from(parts)
    .where(eq(parts.id, partId))
    .limit(1)
  if (!row) throw createError({ statusCode: 404, message: 'Part not found' })
  if (!isAdminUser(user) && row.teacherId !== user.id) {
    throw createError({ statusCode: 403, message: 'You can only edit your own parts' })
  }
  return row
}

export async function assertCanManageGroup(user: AuthUser, groupId: string) {
  const [row] = await useDb()
    .select({ id: questionGroups.id, partId: questionGroups.partId, teacherId: parts.teacherId })
    .from(questionGroups)
    .innerJoin(parts, eq(parts.id, questionGroups.partId))
    .where(eq(questionGroups.id, groupId))
    .limit(1)
  if (!row) throw createError({ statusCode: 404, message: 'Question group not found' })
  if (!isAdminUser(user) && row.teacherId !== user.id) {
    throw createError({ statusCode: 403, message: 'You can only edit your own parts' })
  }
  return row
}

export async function assertCanManageWritingTask(user: AuthUser, taskId: string) {
  const [row] = await useDb()
    .select({ id: writingTasks.id, teacherId: writingTasks.teacherId })
    .from(writingTasks)
    .where(eq(writingTasks.id, taskId))
    .limit(1)
  if (!row) throw createError({ statusCode: 404, message: 'Writing task not found' })
  if (!isAdminUser(user) && row.teacherId !== user.id) {
    throw createError({ statusCode: 403, message: 'You can only edit your own writing tasks' })
  }
  return row
}

export async function assertCanManageSpeakingPart(user: AuthUser, partId: string) {
  const [row] = await useDb()
    .select({ id: speakingParts.id, teacherId: speakingParts.teacherId })
    .from(speakingParts)
    .where(eq(speakingParts.id, partId))
    .limit(1)
  if (!row) throw createError({ statusCode: 404, message: 'Speaking part not found' })
  if (!isAdminUser(user) && row.teacherId !== user.id) {
    throw createError({ statusCode: 403, message: 'You can only edit your own speaking parts' })
  }
  return row
}

/** Whether a user (or guest when null) may view/sit a given test. */
export async function canViewTest(
  user: Pick<AuthUser, 'id' | 'role'> | null | undefined,
  test: { id: string, status: string, visibility?: string | null, teacherId?: string | null }
): Promise<boolean> {
  const isPrivate = test.visibility === 'PRIVATE' || !!test.teacherId
  if (!isPrivate) return true
  if (!user) return false
  if (isAdminUser(user)) return true
  if (test.teacherId && test.teacherId === user.id) return true
  if (test.status !== 'PUBLISHED') return false

  const db = useDb()

  // 1. Direct student share
  const [direct] = await db
    .select({ testId: testStudents.testId })
    .from(testStudents)
    .where(and(eq(testStudents.testId, test.id), eq(testStudents.userId, user.id)))
    .limit(1)
  if (direct) return true

  // 2. Shared with one of the student's classes, or assigned to one of their classes
  const memberGroups = await db
    .select({ groupId: classMembers.groupId })
    .from(classMembers)
    .where(eq(classMembers.userId, user.id))
  const groupIds = memberGroups.map(g => g.groupId)
  if (groupIds.length) {
    const [byGroup, byAssign] = await Promise.all([
      db.select({ testId: testGroups.testId })
        .from(testGroups)
        .where(and(eq(testGroups.testId, test.id), inArray(testGroups.groupId, groupIds)))
        .limit(1),
      db.select({ id: assignments.id })
        .from(assignments)
        .where(and(eq(assignments.testId, test.id), inArray(assignments.groupId, groupIds)))
        .limit(1)
    ])
    if (byGroup.length || byAssign.length) return true
  }

  // 3. Active mock session candidate for this test
  const [mockRow] = await db
    .select({ id: mockCandidates.id })
    .from(mockCandidates)
    .innerJoin(mockSessions, eq(mockSessions.id, mockCandidates.sessionId))
    .where(and(eq(mockCandidates.userId, user.id), eq(mockSessions.testId, test.id)))
    .limit(1)
  return !!mockRow
}

/** Enforces visibility; returns 404 (not 403) so private test slugs cannot be enumerated. */
export async function assertCanViewTest(
  user: Pick<AuthUser, 'id' | 'role'> | null | undefined,
  test: { id: string, status: string, visibility?: string | null, teacherId?: string | null }
) {
  if (!(await canViewTest(user, test))) {
    throw createError({ statusCode: 404, message: 'Test not found' })
  }
}

/** Audience (classes + direct students) currently granted access to a test. */
export async function testAudienceOf(testId: string) {
  const db = useDb()
  const [groups, students] = await Promise.all([
    db.select({ groupId: testGroups.groupId }).from(testGroups).where(eq(testGroups.testId, testId)),
    db.select({ userId: testStudents.userId }).from(testStudents).where(eq(testStudents.testId, testId))
  ])
  return {
    groupIds: groups.map(g => g.groupId),
    studentIds: students.map(s => s.userId)
  }
}

/** Replaces the classes and individual students allowed to see a private test. */
export async function setTestAudience(user: AuthUser, testId: string, rawGroupIds: string[], rawStudentIds: string[]) {
  const row = await assertCanManageTest(user, testId)
  const db = useDb()

  const uniqueGroups = [...new Set(rawGroupIds.map(String).filter(Boolean))]
  const uniqueStudents = [...new Set(rawStudentIds.map(String).filter(Boolean))]

  // Validate classes belong to the owning teacher (or any class when admin edits a platform test).
  const ownerTeacherId = row.teacherId ?? (isAdminUser(user) ? null : user.id)
  let validGroupIds: string[] = []
  if (uniqueGroups.length) {
    const found = await db
      .select({ id: classGroups.id })
      .from(classGroups)
      .where(ownerTeacherId
        ? and(inArray(classGroups.id, uniqueGroups), eq(classGroups.teacherId, ownerTeacherId))
        : inArray(classGroups.id, uniqueGroups))
    validGroupIds = found.map(g => g.id)
  }

  // Validate individual students: teachers may pick any student enrolled in any of their classes
  // (or already granted access to this test); admins may pick any existing user.
  let validStudentIds: string[] = []
  if (uniqueStudents.length) {
    if (isAdminUser(user)) {
      const found = await db.select({ id: users.id }).from(users).where(inArray(users.id, uniqueStudents))
      validStudentIds = found.map(u => u.id)
    } else {
      const teacherClasses = await db
        .select({ id: classGroups.id })
        .from(classGroups)
        .where(eq(classGroups.teacherId, user.id))
      const classIds = teacherClasses.map(c => c.id)
      const [roster, existing] = await Promise.all([
        classIds.length
          ? db.select({ userId: classMembers.userId }).from(classMembers)
              .where(and(inArray(classMembers.groupId, classIds), inArray(classMembers.userId, uniqueStudents)))
          : Promise.resolve([]),
        db.select({ userId: testStudents.userId }).from(testStudents)
          .where(and(eq(testStudents.testId, testId), inArray(testStudents.userId, uniqueStudents)))
      ])
      const allowed = new Set([...roster.map(r => r.userId), ...existing.map(e => e.userId)])
      validStudentIds = uniqueStudents.filter(id => allowed.has(id))
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(testGroups).where(eq(testGroups.testId, testId))
    if (validGroupIds.length) {
      await tx.insert(testGroups).values(validGroupIds.map(groupId => ({ testId, groupId }))).onConflictDoNothing()
    }
    await tx.delete(testStudents).where(eq(testStudents.testId, testId))
    if (validStudentIds.length) {
      await tx.insert(testStudents).values(validStudentIds.map(userId => ({ testId, userId }))).onConflictDoNothing()
    }
  })

  return { groupIds: validGroupIds, studentIds: validStudentIds }
}

/** All published private teacher tests a student has been granted access to (via class, direct share, or assignment). */
export async function listStudentTeacherTests(userId: string, exam?: Exam | null) {
  const db = useDb()

  const memberGroups = await db
    .select({ groupId: classMembers.groupId, groupName: classGroups.name })
    .from(classMembers)
    .innerJoin(classGroups, eq(classGroups.id, classMembers.groupId))
    .where(eq(classMembers.userId, userId))

  const groupIds = memberGroups.map(g => g.groupId)
  const groupNameById = new Map(memberGroups.map(g => [g.groupId, g.groupName]))

  const [directRows, groupRows, assignRows] = await Promise.all([
    db.select({ testId: testStudents.testId }).from(testStudents).where(eq(testStudents.userId, userId)),
    groupIds.length
      ? db.select({ testId: testGroups.testId, groupId: testGroups.groupId }).from(testGroups).where(inArray(testGroups.groupId, groupIds))
      : Promise.resolve([]),
    groupIds.length
      ? db.select({ testId: assignments.testId, groupId: assignments.groupId }).from(assignments).where(inArray(assignments.groupId, groupIds))
      : Promise.resolve([])
  ])

  const classesByTest = new Map<string, Set<string>>()
  const addClass = (testId: string, groupId?: string) => {
    const set = classesByTest.get(testId) ?? new Set<string>()
    if (groupId) {
      const name = groupNameById.get(groupId)
      if (name) set.add(name)
    }
    classesByTest.set(testId, set)
  }

  for (const r of directRows) addClass(r.testId)
  for (const r of groupRows) addClass(r.testId, r.groupId)
  for (const r of assignRows) addClass(r.testId, r.groupId)

  const testIds = [...classesByTest.keys()]
  if (!testIds.length) return []

  const rows = await db.query.tests.findMany({
    where: and(
      inArray(tests.id, testIds),
      eq(tests.visibility, 'PRIVATE'),
      eq(tests.status, 'PUBLISHED')
    ),
    orderBy: [desc(tests.publishedAt), desc(tests.createdAt)],
    with: { sections: { orderBy: (t, { asc }) => [asc(t.position)], with: { items: { with: { part: { with: { groups: { with: { items: { columns: { id: true } } } } } } } } } } }
  })

  const teacherIds = [...new Set(rows.map(r => r.teacherId).filter(Boolean))] as string[]
  const teachers = teacherIds.length
    ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, teacherIds))
    : []
  const teacherMap = new Map(teachers.map(t => [t.id, t.name || t.email || 'Teacher']))

  return rows
    .filter(r => !exam || examOfTest(r) === exam)
    .map(r => ({
      ...testSummary(r),
      visibility: r.visibility,
      teacherId: r.teacherId,
      teacherName: r.teacherId ? (teacherMap.get(r.teacherId) ?? 'Teacher') : null,
      sharedGroups: [...(classesByTest.get(r.id) ?? [])]
    }))
}
