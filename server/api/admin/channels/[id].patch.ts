import { eq } from 'drizzle-orm'
import { telegramChannels } from '../../../database/schema'

// Changes which exam a channel is for, or the language posts there are in.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = (await readBody<{ exam?: string | null, locale?: string }>(event)) ?? {}
  const set: Partial<typeof telegramChannels.$inferInsert> = {}
  if (body.exam !== undefined) set.exam = asChannelExam(body.exam)
  if (body.locale !== undefined) set.locale = asLocale(body.locale)
  if (!Object.keys(set).length) throw createError({ statusCode: 400, message: 'Nothing to change' })
  const [row] = await useDb().update(telegramChannels).set(set).where(eq(telegramChannels.id, String(getRouterParam(event, 'id')))).returning()
  if (!row) throw createError({ statusCode: 404, message: 'Channel not found (TELEGRAM_CHANNEL is changed on the server)' })
  return row
})
