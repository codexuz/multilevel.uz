// Lays the curriculum out at once (the course builder's drag and drop):
// { modules: [topic ids in order], lessons: [{ id, moduleId | null }, … in order] }.
export default defineEventHandler(async (event) => {
  const { course } = await requireCourseTeacher(event, String(getRouterParam(event, 'id')))
  const body = (await readBody<{ modules?: unknown, lessons?: unknown }>(event)) ?? {}
  const modules = Array.isArray(body.modules) ? body.modules.map(String) : []
  const lessons = Array.isArray(body.lessons)
    ? body.lessons.map((l: { id?: unknown, moduleId?: unknown }) => ({ id: String(l?.id), moduleId: l?.moduleId ? String(l.moduleId) : null }))
    : []
  await arrangeCurriculum(course, { modules, lessons })
  return { ok: true }
})
