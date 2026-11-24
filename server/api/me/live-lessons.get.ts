// My online classes: as a student, those of my classes and courses; as a teacher, my own too.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const [learning, teaching] = await Promise.all([studentLiveLessons(user.id), teacherLiveLessons(user.id)])
  return { learning, teaching }
})
