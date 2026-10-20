export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return saveSection(getRouterParam(event, 'id')!, getRouterParam(event, 'skill')!, await readBody(event))
})
