import { and, eq } from 'drizzle-orm'
import { enrollments } from '../../database/schema'
import { getCourseTree, getCompletedLessonIds } from '../../database/repos/courses'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')!
  const db = useDb()

  const tree = await getCourseTree(db, id, 'student')
  if (!tree || tree.course.status !== 'published') {
    throw createError({ statusCode: 404, message: 'Course not found' })
  }

  const [enrollment] = await db.select().from(enrollments)
    .where(and(eq(enrollments.userId, user.id), eq(enrollments.courseId, id))).limit(1)

  const completed = enrollment ? await getCompletedLessonIds(db, user.id, id) : new Set<string>()
  const progress = tree.lessonCount > 0 ? Math.round((completed.size / tree.lessonCount) * 100) : 0

  return {
    ...tree,
    enrollment: enrollment
      ? {
          status: enrollment.status,
          enrolledAt: enrollment.enrolledAt,
          completedAt: enrollment.completedAt,
          lastLessonId: enrollment.lastLessonId
        }
      : null,
    completedLessonIds: [...completed],
    progress
  }
})
