export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return updateTest(getRouterParam(event, 'id')!, await readBody(event))
})
