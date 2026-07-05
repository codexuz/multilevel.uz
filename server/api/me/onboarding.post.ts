import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1']
const DURATIONS = ['<6m', '6-12m', '1-2y', '2y+']

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{
    currentLevel?: string
    learningDuration?: string
    targetLevel?: string
    targetScore?: number
  }>(event)

  const currentLevel = LEVELS.includes(body.currentLevel ?? '') ? body.currentLevel : null
  const learningDuration = DURATIONS.includes(body.learningDuration ?? '') ? body.learningDuration : null
  const targetLevel = LEVELS.includes(body.targetLevel ?? '') ? body.targetLevel : null
  const targetScore = typeof body.targetScore === 'number' && body.targetScore >= 0 && body.targetScore <= 75
    ? Math.round(body.targetScore)
    : null

  const db = useDb()
  await db.update(users).set({
    currentLevel,
    learningDuration,
    targetLevel,
    targetScore,
    onboarded: true,
    updatedAt: new Date()
  }).where(eq(users.id, user.id))

  return { ok: true }
})
