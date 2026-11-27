export default defineEventHandler(async (event) => {
  const user = await requireTeacher(event)
  const id = getRouterParam(event, 'id')!
  await assertCanManageSpeakingPart(user, id)
  return saveSpeakingPart(id, await readBody(event), user.id, ownerIdFor(user))
})
