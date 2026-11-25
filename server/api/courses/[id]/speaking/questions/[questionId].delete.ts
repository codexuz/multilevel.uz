// Teacher/admin deletes a speaking studio question from a course.
export default defineEventHandler(async (event) => {
  const { course } = await requireCourseTeacher(event, String(getRouterParam(event, 'id')))
  await deleteSpeakingQuestion(course.id, String(getRouterParam(event, 'questionId')))
  return { deleted: true }
})
