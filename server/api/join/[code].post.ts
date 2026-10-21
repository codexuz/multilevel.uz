// Joins a group with its code (taking a seat at its centre, which gives Premium).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return joinGroup(user.id, String(getRouterParam(event, 'code')))
})
