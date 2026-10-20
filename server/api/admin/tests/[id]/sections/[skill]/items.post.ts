export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return addItem(getRouterParam(event, 'id')!, getRouterParam(event, 'skill')!, await readBody(event))
})
