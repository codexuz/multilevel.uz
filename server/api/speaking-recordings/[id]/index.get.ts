// Full social detail view of a speaking recording: audio, AI review, likes, 0-9 ratings, and comments.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return getSpeakingRecordingDetail(user, String(getRouterParam(event, 'id')))
})
