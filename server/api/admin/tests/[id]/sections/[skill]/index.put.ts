export default defineEventHandler(async (event) => {
  const user = await requireTeacher(event)
  const id = getRouterParam(event, 'id')!
  await assertCanManageTest(user, id)
  return saveSection(id, getRouterParam(event, 'skill')!, await readBody(event))
})
