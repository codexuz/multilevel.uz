// My weak spots and progress, with a part to practise for each.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  // ?exam=IELTS|MULTILEVEL, else the exam they prepare for.
  const asked = getQuery(event).exam
  const exam = isExam(asked) ? asked : await preferredExam(user.id)
  return insightsOf(user, exam)
})
