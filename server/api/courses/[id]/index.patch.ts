import { count, eq } from 'drizzle-orm'
import { courseLessons, courses } from '../../../database/schema'

// Changes a course: { title, summary, exam, level, visibility (PRIVATE | PUBLIC), published }. A course is published with a lesson at least.
export default defineEventHandler(async (event) => {
  const { course } = await requireCourseTeacher(event, String(getRouterParam(event, 'id')))
  const set = courseValues((await readBody(event)) ?? {}, true)
  const db = useDb()
  if (set.published && !course.published) {
    const [lessons] = await db.select({ n: count() }).from(courseLessons).where(eq(courseLessons.courseId, course.id))
    if (!lessons?.n) throw createError({ statusCode: 400, message: 'Add a lesson before publishing the course' })
  }
  const [row] = await db.update(courses).set({ ...set, updatedAt: new Date() }).where(eq(courses.id, course.id)).returning()
  return row
})
