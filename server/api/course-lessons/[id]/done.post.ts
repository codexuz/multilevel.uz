import { and, eq, inArray } from 'drizzle-orm'
import { exerciseAttempts, lessonExercises, lessonProgress } from '../../../database/schema'

// Marks a lesson done (verifies enrollment, content drip unlock, and required exercises passed).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const lesson = await findLesson(String(getRouterParam(event, 'id')))
  const course = await findCourse(lesson.courseId)
  const access = await accessTo(user, course)
  if (!access.learn || access.teaches) throw createError({ statusCode: 403, message: 'Enroll in the course first' })

  const db = useDb()
  const { modules, lessons } = await loadOrderedCurriculum(course.id)
  const doneRows = lessons.length
    ? await db.select({ id: lessonProgress.lessonId }).from(lessonProgress).where(and(eq(lessonProgress.userId, user.id), inArray(lessonProgress.lessonId, lessons.map(l => l.id))))
    : []
  const drip = evaluateCourseDrip(course, modules, lessons, new Set(doneRows.map(r => r.id)), false).get(lesson.id)
  if (drip?.locked) throw createError({ statusCode: 403, message: 'This lesson is locked by content drip' })

  const required = await db.select({ id: lessonExercises.id }).from(lessonExercises)
    .where(and(eq(lessonExercises.lessonId, lesson.id), eq(lessonExercises.requiredForCompletion, true)))
  if (required.length) {
    const passed = await db.selectDistinct({ exerciseId: exerciseAttempts.exerciseId }).from(exerciseAttempts)
      .where(and(eq(exerciseAttempts.userId, user.id), eq(exerciseAttempts.passed, true), inArray(exerciseAttempts.exerciseId, required.map(r => r.id))))
    if (passed.length < required.length) {
      throw createError({ statusCode: 400, message: 'Pass all required exercises in this lesson before marking it complete' })
    }
  }

  await db.insert(lessonProgress).values({ lessonId: lesson.id, userId: user.id }).onConflictDoNothing()
  return { done: true }
})
