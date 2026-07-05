import { eq } from 'drizzle-orm'
import { attempts, answers } from '../../../database/schema'

// Autosave a single answer (upsert on attempt+question).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ questionId: string, response?: unknown, audioUrl?: string | null }>(event)
  if (!body?.questionId) throw createError({ statusCode: 400, message: 'questionId required' })

  const db = useDb()
  const [attempt] = await db.select().from(attempts).where(eq(attempts.id, id)).limit(1)
  if (!attempt || attempt.userId !== user.id) throw createError({ statusCode: 403, message: 'Forbidden' })
  if (attempt.status !== 'in_progress') throw createError({ statusCode: 409, message: 'Attempt already submitted' })

  await db.insert(answers).values({
    attemptId: id,
    questionId: body.questionId,
    response: body.response ?? null,
    audioUrl: body.audioUrl ?? null,
    updatedAt: new Date()
  }).onConflictDoUpdate({
    target: [answers.attemptId, answers.questionId],
    set: { response: body.response ?? null, audioUrl: body.audioUrl ?? null, updatedAt: new Date() }
  })

  return { ok: true }
})
