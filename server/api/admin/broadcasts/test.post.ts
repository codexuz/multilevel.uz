// Sends the draft to the admin's own Telegram only.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  return await sendTestBroadcast(admin.id, draftOf(await readBody(event)))
})
