// Admin-only: disconnects the shared platform Google Calendar connection.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await disconnectPlatform()
  return { connected: false }
})
