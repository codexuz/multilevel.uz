// Whether this user has joined the bot, checked with Telegram itself when not yet recorded.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return { joined: await checkBotJoined(user.id) }
})
