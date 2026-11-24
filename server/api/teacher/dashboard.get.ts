import { and, asc, count, desc, eq, gte, inArray, lt } from 'drizzle-orm'
import {
  assignments,
  attempts,
  classGroups,
  classMembers,
  courseLessons,
  courses,
  exerciseAttempts,
  lessonExercises,
  liveLessons,
  tests,
  users
} from '../../database/schema'

const nameOf = (u: { name: string | null, telegramUsername: string | null, email: string | null }) =>
  u.name || (u.telegramUsername ? `@${u.telegramUsername}` : u.email) || 'Student'

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || 'ST'

/**
 * Full Teacher Dashboard data matching the Teacher Panel layout:
 * - KPIs: My Groups, Students, Classes (This Week), Avg. Test Score
 * - My Groups list with student counts, level badge, and completion progress
 * - Today's / upcoming Google Meet classes
 * - Recent test & exercise results from the teacher's students
 * - Group Performance across the last 4 weeks
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (!['teacher', 'center_owner', 'admin'].includes(user.role)) {
    const has = await hasClasses(user.id)
    if (!has) throw createError({ statusCode: 403, message: 'Teacher access required' })
  }

  const db = useDb()
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000)
  const weekAhead = new Date(now.getTime() + 7 * 86_400_000)
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayEnd = new Date(dayStart.getTime() + 86_400_000)
  const fourWeeksAgo = new Date(now.getTime() - 28 * 86_400_000)

  const [groups, myCourses, weekLive, upcomingLive] = await Promise.all([
    db.select().from(classGroups).where(and(eq(classGroups.teacherId, user.id), eq(classGroups.archived, false))).orderBy(desc(classGroups.createdAt)),
    db.select({ id: courses.id, title: courses.title }).from(courses).where(eq(courses.teacherId, user.id)),
    db.select({ n: count() }).from(liveLessons).where(and(eq(liveLessons.teacherId, user.id), eq(liveLessons.status, 'SCHEDULED'), gte(liveLessons.startsAt, dayStart), lt(liveLessons.startsAt, weekAhead))),
    db.select().from(liveLessons).where(and(eq(liveLessons.teacherId, user.id), eq(liveLessons.status, 'SCHEDULED'), gte(liveLessons.startsAt, new Date(now.getTime() - 90 * 60_000)))).orderBy(asc(liveLessons.startsAt)).limit(8)
  ])

  const groupIds = groups.map(g => g.id)
  const members = groupIds.length
    ? await db.select({ groupId: classMembers.groupId, userId: classMembers.userId, joinedAt: classMembers.joinedAt }).from(classMembers).where(inArray(classMembers.groupId, groupIds))
    : []
  const studentIds = [...new Set(members.map(m => m.userId).filter(id => id !== user.id))]

  const [studentsNewThisWeek, groupAssignments, recentAttemptRows, perfAttempts, studentUsers, pendingMarkRow] = await Promise.all([
    Promise.resolve(new Set(members.filter(m => m.joinedAt >= weekAgo && m.userId !== user.id).map(m => m.userId)).size),
    groupIds.length ? db.select().from(assignments).where(inArray(assignments.groupId, groupIds)) : [],
    studentIds.length
      ? db.select({
          id: attempts.id,
          userId: attempts.userId,
          testId: attempts.testId,
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
          .orderBy(desc(attempts.submittedAt)).limit(12)
      : [],
    studentIds.length
      ? db.select({
          userId: attempts.userId,
          exam: attempts.exam,
          score: attempts.score,
          band: attempts.band,
          correct: attempts.correct,
          total: attempts.total,
          submittedAt: attempts.submittedAt
        }).from(attempts).where(and(inArray(attempts.userId, studentIds), gte(attempts.submittedAt, fourWeeksAgo)))
      : [],
    studentIds.length
      ? db.select({ id: users.id, name: users.name, email: users.email, telegramUsername: users.telegramUsername, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, studentIds))
      : [],
    studentIds.length
      ? db.select({ n: count() }).from(attempts).where(and(inArray(attempts.userId, studentIds), eq(attempts.status, 'SUBMITTED')))
      : [{ n: 0 }]
  ])

  // Also include recent LMS exercise scores from teacher's courses
  const myCourseIds = myCourses.map(c => c.id)
  const recentExRows = myCourseIds.length && studentIds.length
    ? await db.select({
        id: exerciseAttempts.id,
        userId: exerciseAttempts.userId,
        score: exerciseAttempts.score,
        passed: exerciseAttempts.passed,
        submittedAt: exerciseAttempts.submittedAt,
        title: lessonExercises.title
      }).from(exerciseAttempts)
        .innerJoin(lessonExercises, eq(lessonExercises.id, exerciseAttempts.exerciseId))
        .innerJoin(courseLessons, eq(courseLessons.id, lessonExercises.lessonId))
        .where(and(inArray(courseLessons.courseId, myCourseIds), inArray(exerciseAttempts.userId, studentIds)))
        .orderBy(desc(exerciseAttempts.submittedAt)).limit(8)
    : []

  const pctOfAttempt = (a: { exam: string, score: number | null, band: number | null, correct: number | null, total: number | null }) => {
    if (a.total && a.correct != null) return Math.round((a.correct / a.total) * 100)
    if (a.score != null) return Math.min(100, Math.round((a.score / 75) * 100))
    if (a.band != null) return Math.min(100, Math.round((a.band / 9) * 100))
    return null
  }

  const allPcts = perfAttempts.map(pctOfAttempt).filter((x): x is number => x != null)
  const avgTestScore = allPcts.length ? Math.round(allPcts.reduce((a, b) => a + b, 0) / allPcts.length) : 0

  const prevWeekPcts = perfAttempts.filter(a => a.submittedAt < weekAgo).map(pctOfAttempt).filter((x): x is number => x != null)
  const thisWeekPcts = perfAttempts.filter(a => a.submittedAt >= weekAgo).map(pctOfAttempt).filter((x): x is number => x != null)
  const prevAvg = prevWeekPcts.length ? prevWeekPcts.reduce((a, b) => a + b, 0) / prevWeekPcts.length : null
  const curAvg = thisWeekPcts.length ? thisWeekPcts.reduce((a, b) => a + b, 0) / thisWeekPcts.length : null
  const scoreDelta = prevAvg != null && curAvg != null ? Math.round(curAvg - prevAvg) : 0

  // Per-group summary cards
  const groupCards = groups.map((g) => {
    const gMembers = members.filter(m => m.groupId === g.id && m.userId !== user.id).map(m => m.userId)
    const gAttempts = perfAttempts.filter(a => gMembers.includes(a.userId))
    const gPcts = gAttempts.map(pctOfAttempt).filter((x): x is number => x != null)
    const progress = gPcts.length ? Math.round(gPcts.reduce((a, b) => a + b, 0) / gPcts.length) : 0
    return {
      id: g.id,
      name: g.name,
      level: g.level,
      joinCode: g.joinCode,
      students: gMembers.length,
      assignments: groupAssignments.filter(a => a.groupId === g.id).length,
      progress
    }
  })

  // Today's & upcoming classes
  const groupNameMap = new Map(groups.map(g => [g.id, g.name]))
  const courseNameMap = new Map(myCourses.map(c => [c.id, c.title]))
  const todaysClasses = upcomingLive.map(l => ({
    id: l.id,
    title: l.title,
    subtitle: (l.groupId ? groupNameMap.get(l.groupId) : l.courseId ? courseNameMap.get(l.courseId) : null) || l.description || 'Online Class',
    startsAt: l.startsAt.toISOString(),
    endsAt: new Date(l.startsAt.getTime() + l.durationMinutes * 60_000).toISOString(),
    durationMinutes: l.durationMinutes,
    meetUrl: l.meetUrl,
    isToday: l.startsAt >= dayStart && l.startsAt < dayEnd,
    isLiveNow: now >= new Date(l.startsAt.getTime() - 10 * 60_000) && now <= new Date(l.startsAt.getTime() + l.durationMinutes * 60_000)
  }))

  // Recent results (exam attempts + LMS exercise attempts merged)
  const userMap = new Map(studentUsers.map(u => [u.id, u]))
  const recentResults = [
    ...recentAttemptRows.map((a) => {
      const u = userMap.get(a.userId)
      const name = u ? nameOf(u) : 'Student'
      return {
        id: a.id,
        kind: 'EXAM' as const,
        studentName: name,
        studentInitials: initialsOf(name),
        avatarUrl: u?.avatarUrl ?? null,
        title: a.testTitle ? `${a.testTitle} (${a.skill})` : a.skill,
        scoreDisplay: a.exam === 'IELTS' && a.band != null ? a.band.toFixed(1) : a.score != null ? `${Math.round((a.score / 75) * 100)}%` : 'Pending',
        badge: a.exam === 'IELTS' ? 'IELTS' : (a.cefrLevel || 'CEFR'),
        submittedAt: a.submittedAt.toISOString(),
        to: `/results/${a.id}`
      }
    }),
    ...recentExRows.map((e) => {
      const u = userMap.get(e.userId)
      const name = u ? nameOf(u) : 'Student'
      return {
        id: e.id,
        kind: 'EXERCISE' as const,
        studentName: name,
        studentInitials: initialsOf(name),
        avatarUrl: u?.avatarUrl ?? null,
        title: e.title,
        scoreDisplay: `${e.score}%`,
        badge: e.passed ? 'Passed' : 'LMS',
        submittedAt: e.submittedAt.toISOString(),
        to: '/teacher/results'
      }
    })
  ].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()).slice(0, 8)

  // Group Performance (last 4 weeks, up to 4 active groups)
  const topGroups = groups.slice(0, 4)
  const weeks = [0, 1, 2, 3].map((w) => {
    const start = new Date(fourWeeksAgo.getTime() + w * 7 * 86_400_000)
    const end = new Date(start.getTime() + 7 * 86_400_000)
    return {
      label: `Week ${w + 1}`,
      values: topGroups.map((g) => {
        const gMembers = new Set(members.filter(m => m.groupId === g.id && m.userId !== user.id).map(m => m.userId))
        const pts = perfAttempts
          .filter(a => gMembers.has(a.userId) && a.submittedAt >= start && a.submittedAt < end)
          .map(pctOfAttempt)
          .filter((x): x is number => x != null)
        return {
          groupId: g.id,
          groupName: g.name,
          value: pts.length ? Math.round(pts.reduce((a, b) => a + b, 0) / pts.length) : 0
        }
      })
    }
  })

  return {
    kpis: {
      myGroups: groups.length,
      groupsThisWeek: groups.filter(g => g.createdAt >= weekAgo).length,
      totalStudents: studentIds.length,
      studentsNewThisWeek,
      classesThisWeek: weekLive[0]?.n ?? 0,
      avgTestScore,
      scoreDelta,
      coursesCount: myCourses.length,
      pendingMarking: pendingMarkRow[0]?.n ?? 0
    },
    groups: groupCards,
    todaysClasses,
    recentResults,
    performanceGroups: topGroups.map(g => ({ id: g.id, name: g.name })),
    groupPerformance: weeks
  }
})
