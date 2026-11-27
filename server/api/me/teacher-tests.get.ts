// Private published tests shared with the signed-in student by their teachers (class, direct share, or assignment).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const exam = isExam(query.exam) ? query.exam : null
  const items = await listStudentTeacherTests(user.id, exam)
  return { items }
})
