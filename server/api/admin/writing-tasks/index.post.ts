export default defineEventHandler(async (event) => {
  const user = await requireTeacher(event)
  return createWritingTask(await readBody(event), user.id, ownerIdFor(user))
})
