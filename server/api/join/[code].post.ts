// Joins a class with its code: the teacher's work comes to me, and they see my results.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return joinClass(user.id, String(getRouterParam(event, 'code')))
})
