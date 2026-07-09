import { eq, desc, count, asc, and, sql, inArray } from 'drizzle-orm'
import { courses, enrollments } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = useDb()
  const p = getPagination(event)
  const q = getQuery(event)

  const filters = [eq(courses.status, 'published')]
  if (typeof q.category === 'string' && q.category) filters.push(eq(courses.category, q.category))
  if (typeof q.level === 'string' && q.level) filters.push(eq(courses.level, q.level))
  const where = and(...filters)

  const [totalRow] = await db.select({ total: count() }).from(courses).where(where)
  const rows = await db.select({
    id: courses.id,
    title: courses.title,
    slug: courses.slug,
    description: courses.description,
    thumbnailUrl: courses.thumbnailUrl,
    level: courses.level,
    category: courses.category,
    isPremium: courses.isPremium,
    estimatedMinutes: courses.estimatedMinutes,
    createdAt: courses.createdAt,
    lessonCount: sql<number>`(
      select count(*)::int
      from "lessons" l
      inner join "course_modules" m on m."id" = l."module_id"
      where m."course_id" = "courses"."id"
    )`
  }).from(courses)
    .where(where)
    .orderBy(asc(courses.orderIndex), desc(courses.createdAt))
    .limit(p.pageSize).offset(p.offset)

  // Mark which of these the user is already enrolled in.
  const ids = rows.map(r => r.id)
  const enrolled = ids.length
    ? await db.select({ courseId: enrollments.courseId }).from(enrollments)
        .where(and(eq(enrollments.userId, user.id), inArray(enrollments.courseId, ids)))
    : []
  const enrolledSet = new Set(enrolled.map(e => e.courseId))

  return paginate(rows.map(r => ({ ...r, enrolled: enrolledSet.has(r.id) })), totalRow?.total ?? 0, p)
})
