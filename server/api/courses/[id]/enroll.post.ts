import { and, eq } from 'drizzle-orm'
import { courses, enrollments } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')!
  const db = useDb()

  const [course] = await db.select().from(courses).where(eq(courses.id, id)).limit(1)
  if (!course || course.status !== 'published') throw createError({ statusCode: 404, message: 'Course not found' })

  if (course.isPremium && !(await hasActivePremium(user.id))) {
    throw createError({ statusCode: 403, message: 'This course requires Premium' })
  }

  const [existing] = await db.select().from(enrollments)
    .where(and(eq(enrollments.userId, user.id), eq(enrollments.courseId, id))).limit(1)
  if (existing) {
    // Re-activate a previously canceled enrollment.
    if (existing.status === 'canceled') {
      await db.update(enrollments).set({ status: 'active' }).where(eq(enrollments.id, existing.id))
    }
    return { id: existing.id, status: 'active' as const }
  }

  const [row] = await db.insert(enrollments).values({
    userId: user.id,
    courseId: id
  }).returning()

  return { id: row!.id, status: row!.status }
})
