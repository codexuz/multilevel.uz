import { desc, eq, inArray } from 'drizzle-orm'
import { attempts, classGroups, classMembers, courseLessons, courses, exerciseAttempts, lessonExercises, tests, users } from '../../database/schema'

const nameOf = (u: { name: string | null, telegramUsername: string | null, email: string | null }) =>
  u.name || (u.telegramUsername ? `@${u.telegramUsername}` : u.email) || 'Student'

// Combined exam attempts and LMS exercise results for a teacher's students.
export default defineEventHandler(async (event) => {
  const user = await requireTeacher(event)
  const db = useDb()
  const [groups, myCourses] = await Promise.all([
    db.select({ id: classGroups.id, name: classGroups.name }).from(classGroups).where(eq(classGroups.teacherId, user.id)),
    db.select({ id: courses.id, title: courses.title }).from(courses).where(eq(courses.teacherId, user.id))
  ])
  const groupIds = groups.map(g => g.id)
  const members = groupIds.length ? await db.select().from(classMembers).where(inArray(classMembers.groupId, groupIds)) : []
  const studentIds = [...new Set(members.map(m => m.userId).filter(id => id !== user.id))]

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
          .orderBy(desc(attempts.submittedAt)).limit(100)
      : [],
    myCourses.length
      ? db.select({
          id: exerciseAttempts.id,
          userId: exerciseAttempts.userId,
          score: exerciseAttempts.score,
          earnedPoints: exerciseAttempts.earnedPoints,
          totalPoints: exerciseAttempts.totalPoints,
          passed: exerciseAttempts.passed,
          submittedAt: exerciseAttempts.submittedAt,
          exerciseTitle: lessonExercises.title,
          lessonTitle: courseLessons.title,
          courseTitle: courses.title
        }).from(exerciseAttempts)
          .innerJoin(lessonExercises, eq(lessonExercises.id, exerciseAttempts.exerciseId))
          .innerJoin(courseLessons, eq(courseLessons.id, lessonExercises.lessonId))
          .innerJoin(courses, eq(courses.id, courseLessons.courseId))
          .where(inArray(courses.id, myCourses.map(c => c.id)))
          .orderBy(desc(exerciseAttempts.submittedAt)).limit(100)
      : [],
    Promise.resolve([] as Array<{ id: string, name: string | null, email: string | null, telegramUsername: string | null, avatarUrl: string | null }>)
  ])

  const allUserIds = [...new Set([...studentIds, ...exRows.map(r => r.userId)])]
  const loadedUsers = allUserIds.length
    ? await db.select({ id: users.id, name: users.name, email: users.email, telegramUsername: users.telegramUsername, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, allUserIds))
    : userRows
  const uMap = new Map(loadedUsers.map(u => [u.id, u]))

  return {
    examResults: examRows.map((a) => {
      const u = uMap.get(a.userId)
      return {
        id: a.id,
        studentName: u ? nameOf(u) : 'Student',
        avatarUrl: u?.avatarUrl ?? null,
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
        courseTitle: e.courseTitle,
        lessonTitle: e.lessonTitle,
        exerciseTitle: e.exerciseTitle,
        score: e.score,
        earnedPoints: e.earnedPoints,
        totalPoints: e.totalPoints,
        passed: e.passed,
        submittedAt: e.submittedAt
      }
    })
  }
})
