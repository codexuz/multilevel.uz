export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return listTests(getQuery(event))
})
