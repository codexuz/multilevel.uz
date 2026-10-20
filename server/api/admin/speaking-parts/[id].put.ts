export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)
  return saveSpeakingPart(getRouterParam(event, 'id')!, await readBody(event), user.id)
})
