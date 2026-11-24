// Fetches an exercise with its questions (sanitized for students, full keys for teachers/admins) and the user's attempts.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const exercise = await findExercise(String(getRouterParam(event, 'id')))
  return getExerciseView(user, exercise)
})
