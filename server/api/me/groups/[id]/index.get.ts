// One of my groups: its work with my results, online classes, decks and classmates (members only).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return await studentGroup(user.id, String(getRouterParam(event, 'id')))
})
