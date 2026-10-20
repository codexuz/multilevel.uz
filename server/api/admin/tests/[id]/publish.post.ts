export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return setStatus(getRouterParam(event, 'id')!, 'PUBLISHED')
})
