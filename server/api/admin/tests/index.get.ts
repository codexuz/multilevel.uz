export default defineEventHandler(async (event) => {
  const user = await requireTeacher(event)
  return listTests(getQuery(event), { teacherId: ownerIdFor(user) })
})
