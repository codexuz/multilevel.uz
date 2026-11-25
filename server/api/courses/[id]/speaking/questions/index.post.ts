// Teacher/admin adds a speaking studio question to a course.
export default defineEventHandler(async (event) => {
  const { user, course } = await requireCourseTeacher(event, String(getRouterParam(event, 'id')))
  return createSpeakingQuestion(course, user.id, (await readBody(event)) ?? {})
})
