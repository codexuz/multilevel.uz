// Adds a Telegram channel to post live mocks to, once Telegram confirms the bot can post there.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = (await readBody<{ chat?: string, exam?: string | null, locale?: string }>(event)) ?? {}
  return addChannel(String(body.chat ?? ''), asChannelExam(body.exam), asLocale(body.locale || 'uz'))
})
