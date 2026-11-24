import { eq } from 'drizzle-orm'
import { courseLessons, courses } from '../../../database/schema'

// Changes a lesson: { title, body, videoUrl, task: { testId, skill, partNumber } | null, files }.
export default defineEventHandler(async (event) => {
  const { course, lesson } = await requireLessonTeacher(event, String(getRouterParam(event, 'id')))
  const set = await lessonValues((await readBody(event)) ?? {}, true)
  const [row] = await useDb().update(courseLessons).set({ ...set, updatedAt: new Date() }).where(eq(courseLessons.id, lesson.id)).returning()
  await useDb().update(courses).set({ updatedAt: new Date() }).where(eq(courses.id, course.id))
  return { id: row!.id }
})
