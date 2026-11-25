import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { attempts, classGroups, classMembers, courseLessons, courses, exerciseAttempts, lessonExercises, tests, users } from '../../database/schema'

const nameOf = (u: { name: string | null, telegramUsername: string | null, email: string | null }) =>
  u.name || (u.telegramUsername ? `@${u.telegramUsername}` : u.email) || 'Student'

// Combined exam attempts and LMS exercise results for a teacher's students; ?groupId= for one class's.
export default defineEventHandler(async (event) => {
  const groupId = typeof getQuery(event).groupId === 'string' ? String(getQuery(event).groupId) : ''
  // One class: its teacher (or an admin looking in); otherwise all of my classes.
  const one = groupId ? await requireClassTeacher(event, groupId) : null
  const user = one?.user ?? await requireTeacher(event)
  const teacherId = one?.group.teacherId ?? user.id
  const db = useDb()
  const [groups, myCourses] = await Promise.all([
    db.select({ id: classGroups.id, name: classGroups.name, archived: classGroups.archived }).from(classGroups).where(eq(classGroups.teacherId, teacherId)),
    db.select({ id: courses.id, title: courses.title }).from(courses).where(eq(courses.teacherId, teacherId))
  ])
  const groupIds = groupId ? [groupId] : groups.map(g => g.id)
  const allMembers = groups.length ? await db.select().from(classMembers).where(inArray(classMembers.groupId, groups.map(g => g.id))) : []
  const members = allMembers.filter(m => groupIds.includes(m.groupId))
  const studentIds = [...new Set(members.map(m => m.userId).filter(id => id !== teacherId))]
  const gName = new Map(groups.map(g => [g.id, g.name]))
  // The classes (of this teacher) each student is in.
  const classesOf = (userId: string) => allMembers.filter(m => m.userId === userId).map(m => gName.get(m.groupId)!).filter(Boolean)

  const [examRows, exRows, userRows] = await Promise.all([
    studentIds.length
      ? db.select({
          id: attempts.id,
          userId: attempts.userId,
          skill: attempts.skill,
          exam: attempts.exam,
          score: attempts.score,
          band: attempts.band,
          cefrLevel: attempts.cefrLevel,
          status: attempts.status,
          submittedAt: attempts.submittedAt,
          testTitle: tests.title
        }).from(attempts).leftJoin(tests, eq(tests.id, attempts.testId))
          .where(inArray(attempts.userId, studentIds))
          .orderBy(desc(attempts.submittedAt)).limit(300)
      : [],
    myCourses.length
      ? db.select({
          id: exerciseAttempts.id,
          userId: exerciseAttempts.userId,
          score: exerciseAttempts.score,
          earnedPoints: exerciseAttempts.earnedPoints,
          totalPoints: exerciseAttempts.totalPoints,
          passed: exerciseAttempts.passed,
          reviewStatus: exerciseAttempts.reviewStatus,
          submittedAt: exerciseAttempts.submittedAt,
          exerciseTitle: lessonExercises.title,
          lessonTitle: courseLessons.title,
          courseTitle: courses.title
        }).from(exerciseAttempts)
          .innerJoin(lessonExercises, eq(lessonExercises.id, exerciseAttempts.exerciseId))
          .innerJoin(courseLessons, eq(courseLessons.id, lessonExercises.lessonId))
          .innerJoin(courses, eq(courses.id, courseLessons.courseId))
          .where(groupId
            ? and(inArray(courses.id, myCourses.map(c => c.id)), studentIds.length ? inArray(exerciseAttempts.userId, studentIds) : sql`false`)
            : inArray(courses.id, myCourses.map(c => c.id)))
          .orderBy(desc(exerciseAttempts.submittedAt)).limit(300)
      : [],
    Promise.resolve([] as Array<{ id: string, name: string | null, email: string | null, telegramUsername: string | null, avatarUrl: string | null }>)
  ])

  const allUserIds = [...new Set([...studentIds, ...exRows.map(r => r.userId)])]
  const loadedUsers = allUserIds.length
    ? await db.select({ id: users.id, name: users.name, email: users.email, telegramUsername: users.telegramUsername, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, allUserIds))
    : userRows
  const uMap = new Map(loadedUsers.map(u => [u.id, u]))

  return {
    groups: groups.filter(g => !g.archived || g.id === groupId).map(g => ({ id: g.id, name: g.name })),
    examResults: examRows.map((a) => {
      const u = uMap.get(a.userId)
      return {
        id: a.id,
        studentName: u ? nameOf(u) : 'Student',
        avatarUrl: u?.avatarUrl ?? null,
        userId: a.userId,
        classes: classesOf(a.userId),
        testTitle: a.testTitle || 'Mock Test',
        skill: a.skill,
        exam: a.exam,
        score: a.score,
        band: a.band,
        cefrLevel: a.cefrLevel,
        status: a.status,
        submittedAt: a.submittedAt,
        to: `/results/${a.id}`
      }
    }),
    exerciseResults: exRows.map((e) => {
      const u = uMap.get(e.userId)
      return {
        id: e.id,
        studentName: u ? nameOf(u) : 'Student',
        avatarUrl: u?.avatarUrl ?? null,
        userId: e.userId,
        classes: classesOf(e.userId),
        courseTitle: e.courseTitle,
        lessonTitle: e.lessonTitle,
        exerciseTitle: e.exerciseTitle,
        score: e.score,
        earnedPoints: e.earnedPoints,
        totalPoints: e.totalPoints,
        passed: e.passed,
        reviewStatus: e.reviewStatus,
        submittedAt: e.submittedAt
      }
    })
  }
})
