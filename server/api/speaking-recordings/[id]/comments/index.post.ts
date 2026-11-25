// Enrolled student or course teacher comments on a speaking studio recording.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return createSpeakingComment(user, String(getRouterParam(event, 'id')), (await readBody(event)) ?? {})
})
