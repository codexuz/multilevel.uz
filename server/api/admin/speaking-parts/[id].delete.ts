export default defineEventHandler(async (event) => {
  const user = await requireTeacher(event)
  const id = getRouterParam(event, 'id')!
  await assertCanManageSpeakingPart(user, id)
  return deleteSpeakingPart(id)
})
