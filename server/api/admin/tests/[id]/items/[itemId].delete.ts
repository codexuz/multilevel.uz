export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return removeItem(getRouterParam(event, 'id')!, getRouterParam(event, 'itemId')!)
})
