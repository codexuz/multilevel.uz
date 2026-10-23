// The centre's students not in the session yet, to add.
export default defineEventHandler(async (event) => {
  const { session } = await requireSession(event, String(getRouterParam(event, 'id')))
  return studentsToAdd(session)
})
