import { desc, count, sql } from 'drizzle-orm'
import { courses } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const db = useDb()
  const p = getPagination(event)

  const [totalRow] = await db.select({ total: count() }).from(courses)
  const rows = await db.select({
    id: courses.id,
    title: courses.title,
    slug: courses.slug,
    description: courses.description,
    thumbnailUrl: courses.thumbnailUrl,
    level: courses.level,
    category: courses.category,
    status: courses.status,
    isPremium: courses.isPremium,
    createdAt: courses.createdAt,
    lessonCount: sql<number>`(
      select count(*)::int
      from "lessons" l
      inner join "course_modules" m on m."id" = l."module_id"
      where m."course_id" = "courses"."id"
    )`
  }).from(courses)
    .orderBy(desc(courses.createdAt))
    .limit(p.pageSize).offset(p.offset)

  return paginate(rows, totalRow?.total ?? 0, p)
})
