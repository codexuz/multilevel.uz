// Takes a student out of the class.
export default defineEventHandler(async (event) => {
  const { group } = await requireClassTeacher(event, String(getRouterParam(event, 'id')))
  await leaveClass(group.id, String(getRouterParam(event, 'userId')))
  return { ok: true }
})
