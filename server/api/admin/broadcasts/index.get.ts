// The broadcasts sent (newest first, with how far each got), the channels, and whether the bot is set up.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const [items, channels] = await Promise.all([recentBroadcasts(), postChannels()])
  return { items, channels: channels.map(c => ({ id: c.id, title: c.title, exam: c.exam, locale: c.locale })), botReady: !!telegramBotToken() }
})
