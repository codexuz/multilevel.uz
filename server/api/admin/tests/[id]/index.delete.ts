export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return deleteTest(getRouterParam(event, 'id')!)
})
