import { lessonProgress } from '../../../database/schema'

// I have done this lesson.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const lesson = await findLesson(String(getRouterParam(event, 'id')))
  const access = await accessTo(user, await findCourse(lesson.courseId))
  if (!access.learn || access.teaches) throw createError({ statusCode: 403, message: 'Enroll in the course first' })
  await useDb().insert(lessonProgress).values({ lessonId: lesson.id, userId: user.id }).onConflictDoNothing()
  return { done: true }
})
