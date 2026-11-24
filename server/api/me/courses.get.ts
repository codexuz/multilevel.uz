// My courses: those I take (with how far I am), and those I teach.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const [learning, teaching] = await Promise.all([learnerCourses(user.id), teacherCourses(user.id)])
  return { learning, teaching }
})
