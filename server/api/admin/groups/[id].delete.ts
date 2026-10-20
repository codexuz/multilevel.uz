export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return deleteGroup(getRouterParam(event, 'id')!)
})
