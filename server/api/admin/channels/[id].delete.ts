// Stops posting live mocks to a channel.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return removeChannel(String(getRouterParam(event, 'id')))
})
