export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return reorderItems(getRouterParam(event, 'id')!, getRouterParam(event, 'skill')!, (await readBody(event))?.ids)
})
