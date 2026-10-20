export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return deletePart(getRouterParam(event, 'id')!)
})
