export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return updatePart(getRouterParam(event, 'id')!, await readBody(event))
})
