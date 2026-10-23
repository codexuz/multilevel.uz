// The parts that can go in a pack of an exam (?exam=IELTS|MULTILEVEL), drafts too.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const exam = getQuery(event).exam
  if (!isExam(exam)) throw createError({ statusCode: 400, message: 'Pick the exam' })
  return packableParts(exam)
})
