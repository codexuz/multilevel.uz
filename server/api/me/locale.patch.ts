import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'

// Saves my interface language, so the bot writes to me in it.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const locale = String((await readBody<{ locale?: string }>(event))?.locale ?? '')
  if (!['en', 'uz', 'ru'].includes(locale)) throw createError({ statusCode: 400, message: 'en, uz or ru' })
  await useDb().update(users).set({ locale }).where(eq(users.id, user.id))
  return { locale }
})
