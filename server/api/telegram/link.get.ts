// The link that opens the bot and joins this user to it when they press Start.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const link = telegramBotToken() ? await botJoinLink(user.id) : null
  if (!link) throw createError({ statusCode: 404, message: 'The Telegram bot is not set up' })
  return link
})
