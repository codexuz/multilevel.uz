export default defineEventHandler(async (event) => {
  const user = await requireTeacher(event)
  return listWritingTasks(getQuery(event), { teacherId: ownerIdFor(user) })
})
