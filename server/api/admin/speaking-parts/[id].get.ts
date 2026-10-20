export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return getSpeakingPart(getRouterParam(event, 'id')!)
})
