// Submits a learner's answers for an exercise, grades all 12 question types, and stores the attempt.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const exercise = await findExercise(String(getRouterParam(event, 'id')))
  return submitExercise(user, exercise, (await readBody(event)) ?? {})
})
