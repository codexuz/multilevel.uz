// Deletes a session nobody has begun; the credits spent on its check-ins come back.
export default defineEventHandler(async (event) => {
  const { session, user } = await requireSession(event, String(getRouterParam(event, 'id')))
  return deleteSession(session, user.id)
})
