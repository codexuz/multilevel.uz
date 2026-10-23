// The Telegram channels live mocks can be posted to.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return postChannels()
})
