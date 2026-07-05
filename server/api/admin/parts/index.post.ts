import { eq, sql } from 'drizzle-orm'
import { parts } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const body = await readBody<{ sectionId?: string, title?: string }>(event)
  if (!body.sectionId) throw createError({ statusCode: 400, message: 'sectionId required' })

  const db = useDb()
  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` }).from(parts).where(eq(parts.sectionId, body.sectionId))

  const [row] = await db.insert(parts).values({
    sectionId: body.sectionId,
    title: body.title ?? `Part ${n + 1}`,
    orderIndex: n
  }).returning()

  return {
    id: row!.id,
    title: row!.title,
    instructions: row!.instructions,
    content: row!.content,
    audioUrl: row!.audioUrl,
    orderIndex: row!.orderIndex,
    questions: []
  }
})
