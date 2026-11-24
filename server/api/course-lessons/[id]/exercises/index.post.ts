// Creates a new interactive exercise inside a course lesson.
export default defineEventHandler(async (event) => {
  const { course, lesson } = await requireLessonTeacher(event, String(getRouterParam(event, 'id')))
  return addExercise(lesson.id, course.id, (await readBody(event)) ?? {})
})
