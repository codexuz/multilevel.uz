// Reorders exercises within a lesson: { ids }.
export default defineEventHandler(async (event) => {
  const { lesson } = await requireLessonTeacher(event, String(getRouterParam(event, 'id')))
  const ids = (await readBody<{ ids?: string[] }>(event))?.ids
  await reorderExercises(lesson.id, Array.isArray(ids) ? ids.map(String) : [])
  return { ok: true }
})
