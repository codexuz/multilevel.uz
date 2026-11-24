import { and, eq } from 'drizzle-orm'
import { courseEnrollments } from '../../../database/schema'

// Leaves a public course (my progress is kept should I come back).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const course = await findCourse(String(getRouterParam(event, 'id')))
  await useDb().delete(courseEnrollments).where(and(eq(courseEnrollments.courseId, course.id), eq(courseEnrollments.userId, user.id)))
  return { enrolled: false }
})
