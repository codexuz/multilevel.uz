import { eq } from 'drizzle-orm'
import { users } from '../../../database/schema'

// Sets my daily XP goal: { goal: 10 | 30 | 50 | 100 }.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const goal = Number((await readBody<{ goal?: unknown }>(event))?.goal)
  if (!DAILY_GOALS.includes(goal as typeof DAILY_GOALS[number])) throw createError({ statusCode: 400, message: `goal: ${DAILY_GOALS.join(', ')}` })
  await useDb().update(users).set({ dailyGoal: goal }).where(eq(users.id, user.id))
  return { goal }
})
