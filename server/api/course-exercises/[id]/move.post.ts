// Moves a quiz to a lesson of the same course (or within its own), at a place: { lessonId, index }.
export default defineEventHandler(async (event) => {
  const { course, exercise } = await requireExerciseTeacher(event, String(getRouterParam(event, 'id')))
  const b = (await readBody<{ lessonId?: string, index?: number }>(event)) ?? {}
  await moveExercise(exercise, course.id, String(b.lessonId ?? ''), Number(b.index ?? Number.MAX_SAFE_INTEGER))
  return { ok: true }
})
