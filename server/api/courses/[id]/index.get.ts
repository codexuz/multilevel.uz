// A course's page (by id or address): its lessons, my progress, and whether I may enroll or open them.
export default defineEventHandler(async (event) => {
  const viewer = await optionalUser(event)
  return courseView(viewer, await findCourse(String(getRouterParam(event, 'id'))))
})
