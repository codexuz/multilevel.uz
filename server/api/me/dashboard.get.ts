import { and, asc, count, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import {
  assignments,
  attempts,
  classGroups,
  classMembers,
  courseLessons,
  exerciseAttempts,
  lessonExercises,
  lessonProgress,
  liveLessons,
  userWords
} from '../../database/schema'

const SKILLS = ['LISTENING', 'READING', 'WRITING', 'SPEAKING'] as const

/**
 * Student Dashboard API:
 * - Overall progress & per-skill averages (Listening, Reading, Writing, Speaking)
 * - Recent tests done
 * - Joined groups, group assignments & upcoming Google Meet classes (when in a group)
 * - LMS course progress (lessons completed, exercises passed, next unlocked lesson)
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = useDb()
  const now = new Date()

  const [
    recentRows,
    allScoredRows,
    [totalAttemptsRow],
    [wordsDueRow],
    myGroups,
    myCourses,
    myExAttempts
  ] = await Promise.all([
    db.query.attempts.findMany({
      where: eq(attempts.userId, user.id),
      with: { test: true },
      orderBy: [desc(attempts.submittedAt)],
      limit: 6
    }),
    db.select({
      skill: attempts.skill,
      exam: attempts.exam,
      score: attempts.score,
      band: attempts.band,
      partNumber: attempts.partNumber,
      submittedAt: attempts.submittedAt
    }).from(attempts)
      .where(eq(attempts.userId, user.id))
      .orderBy(desc(attempts.submittedAt))
      .limit(200),
    db.select({ n: count() }).from(attempts).where(eq(attempts.userId, user.id)),
    db.select({ n: count() }).from(userWords).where(and(eq(userWords.userId, user.id), lte(userWords.dueAt, now))),
    db.select({
      id: classGroups.id,
      name: classGroups.name,
      exam: classGroups.exam,
      level: classGroups.level
    }).from(classMembers)
      .innerJoin(classGroups, eq(classGroups.id, classMembers.groupId))
      .where(and(eq(classMembers.userId, user.id), eq(classGroups.archived, false))),
    learnerCourses(user.id),
    db.select({
      exerciseId: exerciseAttempts.exerciseId,
      score: exerciseAttempts.score,
      passed: exerciseAttempts.passed
    }).from(exerciseAttempts)
      .where(eq(exerciseAttempts.userId, user.id))
      .orderBy(desc(exerciseAttempts.submittedAt))
      .limit(200)
  ])

  // Respect held mock session results on recent attempts
  const heldSet = new Set(
    (await Promise.all(recentRows.filter(r => r.mockCandidateId).map(async r => (await heldFrom(r.id)) ? r.id : null)))
      .filter((x): x is string => !!x)
  )
  const recentTests = recentRows.map(r => (heldSet.has(r.id)
    ? { ...attemptSummary(r), score: null, band: null, correct: null, cefrLevel: null, held: true }
    : attemptSummary(r)))

  // Skill averages (last 3 whole sections per skill, or latest scored attempt)
  const skills = SKILLS.map((skill) => {
    const mine = allScoredRows.filter(r => r.skill === skill && (r.score != null || r.band != null))
    const whole = mine.filter(r => r.partNumber == null)
    const source = whole.length ? whole : mine
    const latest = source[0]
    const isIelts = latest ? (latest.exam === 'IELTS' || (latest.score == null && latest.band != null)) : false
    const vals = source
      .map(r => (isIelts ? r.band : r.score))
      .filter((v): v is number => v != null)
      .slice(0, 3)
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    const value = avg == null ? null : (isIelts ? Math.round(avg * 10) / 10 : Math.round(avg))
    const pct = value == null ? 0 : Math.min(100, Math.round(isIelts ? (value / 9) * 100 : (value / 75) * 100))
    return {
      skill,
      exam: isIelts ? 'IELTS' : 'MULTILEVEL',
      value,
      pct,
      attempts: mine.length
    }
  })

  // Group assignments & upcoming classes (ONLY when student joined at least one group)
  const groupIds = myGroups.map(g => g.id)
  let groupAssignments: Array<{
    id: string
    group: string
    exam: string
    skill: string
    partNumber: number | null
    note: string | null
    dueAt: Date | null
    test: { slug: string, title: string } | null
    to: string | null
    mine: { attemptId: string, score: number | null, band: number | null, status: string, at: Date } | null
  }> = []
  let upcomingClasses: ReturnType<typeof liveView>[] = []

  if (groupIds.length) {
    const [assRows, liveRows] = await Promise.all([
      db.select().from(assignments).where(inArray(assignments.groupId, groupIds)).orderBy(desc(assignments.createdAt)).limit(20),
      db.select().from(liveLessons).where(and(
        inArray(liveLessons.groupId, groupIds),
        eq(liveLessons.status, 'SCHEDULED'),
        gte(liveLessons.startsAt, new Date(now.getTime() - 60 * 60_000))
      )).orderBy(asc(liveLessons.startsAt)).limit(5)
    ])
    const gMap = new Map(myGroups.map(g => [g.id, g.name]))
    groupAssignments = await Promise.all(assRows.map(async (a) => {
      const view = await assignmentView(a, [user.id])
      const mine = (await assignmentHandIns(a, [user.id])).get(user.id) ?? null
      return {
        id: a.id,
        group: gMap.get(a.groupId) ?? '',
        exam: view.exam,
        skill: a.skill,
        partNumber: a.partNumber,
        note: a.note,
        dueAt: a.dueAt,
        test: view.test,
        to: view.to,
        mine
      }
    }))
    // Pending assignments first, then completed
    groupAssignments.sort((a, b) => Number(!!a.mine) - Number(!!b.mine))
    upcomingClasses = liveRows.map(l => liveView(l, false))
  }

  // Enrich LMS course progress with next lesson id and passed exercises count
  const courseIds = myCourses.map(c => c.id)
  const courseLessonsRows = courseIds.length
    ? await db.select({ id: courseLessons.id, courseId: courseLessons.courseId, position: courseLessons.position }).from(courseLessons).where(inArray(courseLessons.courseId, courseIds)).orderBy(asc(courseLessons.position))
    : []
  const lessonIds = courseLessonsRows.map(l => l.id)
  const [doneLessonRows, courseExRows] = await Promise.all([
    lessonIds.length
      ? db.select({ lessonId: lessonProgress.lessonId }).from(lessonProgress).where(and(eq(lessonProgress.userId, user.id), inArray(lessonProgress.lessonId, lessonIds)))
      : [],
    lessonIds.length
      ? db.select({ id: lessonExercises.id, lessonId: lessonExercises.lessonId }).from(lessonExercises).where(inArray(lessonExercises.lessonId, lessonIds))
      : []
  ])
  const doneLessonSet = new Set(doneLessonRows.map(r => r.lessonId))
  const passedExSet = new Set(myExAttempts.filter(a => a.passed).map(a => a.exerciseId))

  const courses = myCourses.map((c) => {
    const cLessons = courseLessonsRows.filter(l => l.courseId === c.id)
    const cLessonIds = new Set(cLessons.map(l => l.id))
    const cExercises = courseExRows.filter(e => cLessonIds.has(e.lessonId))
    const exercisesPassed = cExercises.filter(e => passedExSet.has(e.id)).length
    const nextLesson = cLessons.find(l => !doneLessonSet.has(l.id)) ?? cLessons[0] ?? null
    const progressPct = c.lessons > 0 ? Math.round((c.done / c.lessons) * 100) : 0
    return {
      id: c.id,
      slug: c.slug,
      title: c.title,
      exam: c.exam,
      level: c.level,
      dripMode: c.dripMode,
      modules: c.modules,
      lessons: c.lessons,
      done: c.done,
      progressPct,
      exercisesTotal: cExercises.length,
      exercisesPassed,
      nextLessonId: nextLesson?.id ?? null
    }
  })

  const totalCourseLessons = courses.reduce((s, c) => s + c.lessons, 0)
  const completedCourseLessons = courses.reduce((s, c) => s + c.done, 0)
  const avgExerciseScore = myExAttempts.length
    ? Math.round(myExAttempts.reduce((s, a) => s + a.score, 0) / myExAttempts.length)
    : null

  return {
    summary: {
      testsDone: totalAttemptsRow?.n ?? 0,
      coursesCount: courses.length,
      lessonsCompleted: completedCourseLessons,
      totalCourseLessons,
      exercisesPassed: passedExSet.size,
      avgExerciseScore,
      wordsDue: wordsDueRow?.n ?? 0,
      pendingAssignments: groupAssignments.filter(a => !a.mine).length
    },
    skills,
    recentTests,
    groups: myGroups,
    assignments: groupAssignments,
    upcomingClasses,
    courses
  }
})
