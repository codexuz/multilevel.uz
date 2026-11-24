// A lesson to learn from (enrolled, or a private course's student; or its teacher).
export default defineEventHandler(async (event) => {
  const viewer = await optionalUser(event)
  if (!viewer) throw createError({ statusCode: 401, message: 'Sign in to open the lesson' })
  return lessonView(viewer, await findLesson(String(getRouterParam(event, 'id'))))
})
