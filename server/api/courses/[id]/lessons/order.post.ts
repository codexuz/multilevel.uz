// Puts the course's lessons in this order: { ids }.
export default defineEventHandler(async (event) => {
  const { course } = await requireCourseTeacher(event, String(getRouterParam(event, 'id')))
  const ids = (await readBody<{ ids?: string[] }>(event))?.ids
  await reorderLessons(course, Array.isArray(ids) ? ids.map(String) : [])
  return { ok: true }
})
