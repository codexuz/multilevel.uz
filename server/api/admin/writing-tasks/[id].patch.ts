export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return updateWritingTask(getRouterParam(event, 'id')!, await readBody(event))
})
