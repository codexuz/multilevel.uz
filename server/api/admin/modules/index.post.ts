import { eq, sql } from 'drizzle-orm'
import { courseModules, courses } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const body = await readBody<{ courseId?: string, title?: string, summary?: string }>(event)
  if (!body.courseId) throw createError({ statusCode: 400, message: 'courseId required' })

  const db = useDb()
  const [course] = await db.select({ id: courses.id }).from(courses).where(eq(courses.id, body.courseId)).limit(1)
  if (!course) throw createError({ statusCode: 404, message: 'Course not found' })

  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` }).from(courseModules).where(eq(courseModules.courseId, body.courseId))

  const [row] = await db.insert(courseModules).values({
    courseId: body.courseId,
    title: body.title?.trim() || `Module ${n + 1}`,
    summary: body.summary ?? null,
    orderIndex: n
  }).returning()

  return {
    id: row!.id,
    title: row!.title,
    summary: row!.summary,
    orderIndex: row!.orderIndex,
    lessons: []
  }
})
