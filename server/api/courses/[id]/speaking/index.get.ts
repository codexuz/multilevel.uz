// Fetches a course's Speaking Studio overview (questions with recording counts).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return speakingStudioOverview(user, String(getRouterParam(event, 'id')))
})
