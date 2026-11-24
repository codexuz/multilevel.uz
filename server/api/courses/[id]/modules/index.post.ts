// Adds a new unit/module to a course: { title, description?, dripMode?, availableFrom?, availableTo? }.
export default defineEventHandler(async (event) => {
  const { course } = await requireCourseTeacher(event, String(getRouterParam(event, 'id')))
  return addModule(course, (await readBody(event)) ?? {})
})
