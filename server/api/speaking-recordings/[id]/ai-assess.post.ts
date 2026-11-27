// Runs AI speaking assessment (0–9 IELTS band scale) on a course speaking recording.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return aiAssessSpeakingRecording(user, String(getRouterParam(event, 'id')))
})
