import { eq, sql } from 'drizzle-orm'
import { lessons, courseModules } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const body = await readBody<{
    moduleId?: string
    title?: string
    type?: 'video' | 'article' | 'quiz'
  }>(event)
  if (!body.moduleId) throw createError({ statusCode: 400, message: 'moduleId required' })

  const db = useDb()
  const [mod] = await db.select({ id: courseModules.id }).from(courseModules)
    .where(eq(courseModules.id, body.moduleId)).limit(1)
  if (!mod) throw createError({ statusCode: 404, message: 'Module not found' })

  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` }).from(lessons).where(eq(lessons.moduleId, body.moduleId))

  const [row] = await db.insert(lessons).values({
    moduleId: body.moduleId,
    title: body.title?.trim() || `Lesson ${n + 1}`,
    type: body.type ?? 'article',
    orderIndex: n
  }).returning()

  return {
    id: row!.id,
    moduleId: row!.moduleId,
    title: row!.title,
    type: row!.type,
    content: row!.content,
    videoUrl: row!.videoUrl,
    attachments: row!.attachments,
    durationMinutes: row!.durationMinutes,
    isPreview: row!.isPreview,
    orderIndex: row!.orderIndex
  }
})
