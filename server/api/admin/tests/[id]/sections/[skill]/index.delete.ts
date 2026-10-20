export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return removeSection(getRouterParam(event, 'id')!, getRouterParam(event, 'skill')!)
})
