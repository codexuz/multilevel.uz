export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return reorderGroups(getRouterParam(event, 'id')!, (await readBody(event))?.ids)
})
