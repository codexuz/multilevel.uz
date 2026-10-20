export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return exportTest(await loadTest({ id: getRouterParam(event, 'id')! }))
})
