export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return updateGroup(getRouterParam(event, 'id')!, await readBody(event))
})
