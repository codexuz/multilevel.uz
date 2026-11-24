// Disconnects my Google Calendar: no more Meet links are made (the ones made stay).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await disconnect(user.id)
  return { connected: false }
})
