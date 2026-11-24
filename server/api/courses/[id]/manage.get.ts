// A course for its teacher: every lesson in full, and each learner's progress.
export default defineEventHandler(async (event) => {
  const { course } = await requireCourseTeacher(event, String(getRouterParam(event, 'id')))
  return manageView(course)
})
