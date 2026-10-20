export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return getTest(getRouterParam(event, 'id')!)
})
