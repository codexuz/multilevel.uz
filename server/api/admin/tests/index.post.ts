export default defineEventHandler(async (event) => {
  const user = await requireTeacher(event)
  return createTest(await readBody(event), user.id, ownerIdFor(user))
})
