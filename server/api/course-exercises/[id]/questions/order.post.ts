// Reorders questions in an exercise: { ids }.
export default defineEventHandler(async (event) => {
  const { exercise } = await requireExerciseTeacher(event, String(getRouterParam(event, 'id')))
  const ids = (await readBody<{ ids?: string[] }>(event))?.ids
  await reorderQuestions(exercise.id, Array.isArray(ids) ? ids.map(String) : [])
  return { ok: true }
})
