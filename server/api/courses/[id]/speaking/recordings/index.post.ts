// Enrolled student (or teacher) submits a voice recording answering a speaking studio question.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return createSpeakingRecording(user, String(getRouterParam(event, 'id')), (await readBody(event)) ?? {})
})
