export default defineEventHandler(async (event) => {
  const user = await requireTeacher(event)
  const id = getRouterParam(event, 'id')!
  await assertCanManagePart(user, id)
  return reorderGroups(id, (await readBody(event))?.ids)
})
