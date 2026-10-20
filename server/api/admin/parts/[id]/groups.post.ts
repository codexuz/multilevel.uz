export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return createGroup(getRouterParam(event, 'id')!, await readBody(event))
})
