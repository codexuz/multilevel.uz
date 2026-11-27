export default defineEventHandler(async (event) => {
  const user = await requireTeacher(event)
  const id = getRouterParam(event, 'id')!
  await assertCanManageWritingTask(user, id)
  return updateWritingTask(id, await readBody(event))
})
