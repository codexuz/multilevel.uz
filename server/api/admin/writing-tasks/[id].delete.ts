export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return deleteWritingTask(getRouterParam(event, 'id')!)
})
