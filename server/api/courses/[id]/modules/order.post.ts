// Reorders units/modules in a course: { ids }.
export default defineEventHandler(async (event) => {
  const { course } = await requireCourseTeacher(event, String(getRouterParam(event, 'id')))
  const ids = (await readBody<{ ids?: string[] }>(event))?.ids
  await reorderModules(course, Array.isArray(ids) ? ids.map(String) : [])
  return { ok: true }
})
