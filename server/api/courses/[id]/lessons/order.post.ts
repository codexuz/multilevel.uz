// Puts a course's (or a module's) lessons in order: { ids, moduleId? }.
export default defineEventHandler(async (event) => {
  const { course } = await requireCourseTeacher(event, String(getRouterParam(event, 'id')))
  const body = await readBody<{ ids?: string[], moduleId?: string | null }>(event)
  await reorderLessons(course, Array.isArray(body?.ids) ? body.ids.map(String) : [], body?.moduleId)
  return { ok: true }
})
