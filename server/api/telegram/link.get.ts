// The link that opens the bot and joins this user to it when they press Start. Also makes sure
// the bot's updates come to the address the user is on, so the Start is seen.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const link = telegramBotToken() ? await botJoinLink(user.id) : null
  if (!link) throw createError({ statusCode: 404, message: 'The Telegram bot is not set up' })
  await ensureWebhook(getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin).catch(() => {})
  return link
})
