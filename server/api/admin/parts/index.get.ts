export default defineEventHandler(async (event) => {
  const user = await requireTeacher(event)
  return listParts(getQuery(event), { teacherId: ownerIdFor(user) })
})
