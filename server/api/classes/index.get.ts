// My classes as a teacher, newest first (archived ones last).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return { classes: await classesOfTeacher(user.id) }
})
