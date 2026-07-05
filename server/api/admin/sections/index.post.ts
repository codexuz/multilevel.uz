import { eq, sql } from 'drizzle-orm'
import { sections } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const body = await readBody<{
    testId?: string
    type?: 'listening' | 'reading' | 'writing' | 'speaking'
    title?: string
    durationMinutes?: number
  }>(event)

  if (!body.testId || !body.type) throw createError({ statusCode: 400, message: 'testId and type required' })

  const db = useDb()
  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` }).from(sections).where(eq(sections.testId, body.testId))

  const [row] = await db.insert(sections).values({
    testId: body.testId,
    type: body.type,
    title: body.title ?? `${body.type[0]!.toUpperCase()}${body.type.slice(1)} section`,
    durationMinutes: body.durationMinutes ?? 45,
    orderIndex: n
  }).returning()

  return {
    id: row!.id,
    type: row!.type,
    title: row!.title,
    durationMinutes: row!.durationMinutes,
    orderIndex: row!.orderIndex,
    audioUrl: row!.audioUrl,
    parts: []
  }
})
