// Teacher/admin edits a speaking studio question in a course.
export default defineEventHandler(async (event) => {
  const { course } = await requireCourseTeacher(event, String(getRouterParam(event, 'id')))
  return updateSpeakingQuestion(course.id, String(getRouterParam(event, 'questionId')), (await readBody(event)) ?? {})
})
