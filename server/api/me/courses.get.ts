import { and, eq, desc, sql } from 'drizzle-orm'
import { courses, enrollments } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = useDb()

  const rows = await db.select({
    enrollmentId: enrollments.id,
    status: enrollments.status,
    enrolledAt: enrollments.enrolledAt,
    completedAt: enrollments.completedAt,
    lastLessonId: enrollments.lastLessonId,
    id: courses.id,
    title: courses.title,
    slug: courses.slug,
    description: courses.description,
    thumbnailUrl: courses.thumbnailUrl,
    level: courses.level,
    category: courses.category,
    lessonCount: sql<number>`(
      select count(*)::int
      from "lessons" l
      inner join "course_modules" m on m."id" = l."module_id"
      where m."course_id" = "courses"."id"
    )`,
    completedCount: sql<number>`(
      select count(*)::int
      from "lesson_progress" lp
      where lp."course_id" = "courses"."id"
        and lp."user_id" = ${user.id}
        and lp."completed" = true
    )`
  }).from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(and(eq(enrollments.userId, user.id)))
    .orderBy(desc(enrollments.enrolledAt))

  return rows.map(r => ({
    ...r,
    progress: r.lessonCount > 0 ? Math.round((r.completedCount / r.lessonCount) * 100) : 0
  }))
})
