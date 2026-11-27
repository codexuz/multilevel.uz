export default defineEventHandler(async (event) => {
  const user = await requireTeacher(event)
  return listSpeakingParts(getQuery(event), { teacherId: ownerIdFor(user) })
})
