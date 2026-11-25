// Deletes a speaking studio recording (author or course teacher/admin).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await deleteSpeakingRecording(user, String(getRouterParam(event, 'id')))
  return { deleted: true }
})
