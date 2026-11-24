import { courseEnrollments } from '../../../database/schema'

// Enrolls me in a published public course (free).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const course = await findCourse(String(getRouterParam(event, 'id')))
  const access = await accessTo(user, course)
  if (!access.see || course.visibility !== 'PUBLIC') throw createError({ statusCode: 404, message: 'Course not found' })
  if (access.teaches) throw createError({ statusCode: 400, message: 'This is your own course' })
  await useDb().insert(courseEnrollments).values({ courseId: course.id, userId: user.id }).onConflictDoNothing()
  return { enrolled: true }
})
