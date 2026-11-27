export default defineEventHandler(async (event) => {
  const user = await requireTeacher(event)
  return saveSpeakingPart(null, await readBody(event), user.id, ownerIdFor(user))
})
