import { eq } from 'drizzle-orm'
import { courseLessons } from '../../../database/schema'

// Makes the lesson an online class on Google Meet: { startsAt, durationMinutes } (titled after the lesson).
export default defineEventHandler(async (event) => {
  const { course, lesson } = await requireLessonTeacher(event, String(getRouterParam(event, 'id')))
  if (lesson.liveLessonId) throw createError({ statusCode: 409, message: 'This lesson has an online class already' })
  const body = (await readBody(event)) ?? {}
  const live = await createLiveLesson(course.teacherId, { courseId: course.id }, { ...body, title: body.title || lesson.title })
  await useDb().update(courseLessons).set({ liveLessonId: live.id, updatedAt: new Date() }).where(eq(courseLessons.id, lesson.id))
  return liveView(live, true)
})
