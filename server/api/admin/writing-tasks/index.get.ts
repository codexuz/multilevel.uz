export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return listWritingTasks(getQuery(event))
})
