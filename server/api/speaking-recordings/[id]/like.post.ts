// Toggles a like on a speaking recording (Facebook/Instagram-style).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return toggleSpeakingLike(user, String(getRouterParam(event, 'id')))
})
