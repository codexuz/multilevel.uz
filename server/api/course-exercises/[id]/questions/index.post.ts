// Adds a question (any of the 12 LMS question types) to an exercise.
export default defineEventHandler(async (event) => {
  const { course, exercise } = await requireExerciseTeacher(event, String(getRouterParam(event, 'id')))
  return addQuestion(exercise.id, course.id, (await readBody(event)) ?? {})
})
