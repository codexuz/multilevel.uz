export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)
  return duplicateTest(getRouterParam(event, 'id')!, user.id)
})
