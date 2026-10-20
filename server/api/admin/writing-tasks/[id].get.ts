export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return getWritingTask(getRouterParam(event, 'id')!)
})
