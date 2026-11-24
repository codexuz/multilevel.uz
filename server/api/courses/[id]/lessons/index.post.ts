// A new lesson at the end of the course: { title, body?, videoUrl?, task?, files? }.
export default defineEventHandler(async (event) => {
  const { course } = await requireCourseTeacher(event, String(getRouterParam(event, 'id')))
  const l = await addLesson(course, (await readBody(event)) ?? {})
  return { id: l.id }
})
