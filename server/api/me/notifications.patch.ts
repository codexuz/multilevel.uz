import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'

// Turns Telegram messages from the bot on or off.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ telegram?: boolean }>(event)
  if (typeof body?.telegram !== 'boolean') throw createError({ statusCode: 400, message: 'telegram must be true or false' })
  await useDb().update(users).set({ telegramNotify: body.telegram, updatedAt: new Date() }).where(eq(users.id, user.id))
  return { telegram: body.telegram }
})
