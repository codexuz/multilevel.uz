import { and, eq } from 'drizzle-orm'
import { courses, liveLessons } from '../../../database/schema'

// Deletes a course with its lessons and its learners' progress; its coming online classes are cancelled.
export default defineEventHandler(async (event) => {
  const { course } = await requireCourseTeacher(event, String(getRouterParam(event, 'id')))
  const live = await useDb().select().from(liveLessons).where(and(eq(liveLessons.courseId, course.id), eq(liveLessons.status, 'SCHEDULED')))
  for (const l of live) await cancelLiveLesson(l).catch(e => console.warn('[courses] online class not cancelled:', e?.message))
  await useDb().delete(courses).where(eq(courses.id, course.id))
  return { ok: true }
})
