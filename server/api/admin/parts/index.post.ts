export default defineEventHandler(async (event) => {
  const user = await requireTeacher(event)
  return createPart(await readBody(event), user.id, ownerIdFor(user))
})
