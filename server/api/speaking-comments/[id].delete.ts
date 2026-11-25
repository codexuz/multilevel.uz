// Deletes a speaking studio comment (author or course teacher/admin).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await deleteSpeakingComment(user, String(getRouterParam(event, 'id')))
  return { deleted: true }
})
