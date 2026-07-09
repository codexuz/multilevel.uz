import { and, eq } from 'drizzle-orm'
import { lessons, courseModules, enrollments, lessonProgress } from '../../../../../database/schema'
import { getCourseLessonIds, getCompletedLessonIds } from '../../../../../database/repos/courses'

const LESSON_POINTS = 10

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const courseId = getRouterParam(event, 'id')!
  const lessonId = getRouterParam(event, 'lessonId')!
  const body = await readBody<{ completed?: boolean }>(event).catch(() => ({ completed: true }))
  const completed = body?.completed !== false
  const db = useDb()

  // Confirm the lesson is part of this course.
  const [lesson] = await db.select({ id: lessons.id }).from(lessons)
    .innerJoin(courseModules, eq(lessons.moduleId, courseModules.id))
    .where(and(eq(lessons.id, lessonId), eq(courseModules.courseId, courseId)))
    .limit(1)
  if (!lesson) throw createError({ statusCode: 404, message: 'Lesson not found' })

  const [enrollment] = await db.select().from(enrollments)
    .where(and(eq(enrollments.userId, user.id), eq(enrollments.courseId, courseId))).limit(1)
  if (!enrollment) throw createError({ statusCode: 403, message: 'Enroll to track progress' })

  const [existing] = await db.select().from(lessonProgress)
    .where(and(eq(lessonProgress.userId, user.id), eq(lessonProgress.lessonId, lessonId))).limit(1)

  const wasCompleted = !!existing?.completed
  const now = new Date()

  if (existing) {
    await db.update(lessonProgress).set({
      completed,
      completedAt: completed ? (existing.completedAt ?? now) : null,
      updatedAt: now
    }).where(eq(lessonProgress.id, existing.id))
  } else {
    await db.insert(lessonProgress).values({
      userId: user.id,
      courseId,
      lessonId,
      completed,
      completedAt: completed ? now : null
    })
  }

  // Award points only on the first time a lesson is completed.
  let award = null
  if (completed && !wasCompleted) {
    award = await awardActivity(user.id, LESSON_POINTS, 'lesson')
  }

  // Recompute course progress and mark the enrollment complete if all done.
  const allLessonIds = await getCourseLessonIds(db, courseId)
  const completedSet = await getCompletedLessonIds(db, user.id, courseId)
  const total = allLessonIds.length
  const done = allLessonIds.filter(id => completedSet.has(id)).length
  const progress = total > 0 ? Math.round((done / total) * 100) : 0

  const courseCompleted = total > 0 && done === total
  if (courseCompleted && enrollment.status !== 'completed') {
    await db.update(enrollments).set({ status: 'completed', completedAt: now }).where(eq(enrollments.id, enrollment.id))
  } else if (!courseCompleted && enrollment.status === 'completed') {
    await db.update(enrollments).set({ status: 'active', completedAt: null }).where(eq(enrollments.id, enrollment.id))
  }

  return { ok: true, completed, progress, courseCompleted, award }
})
