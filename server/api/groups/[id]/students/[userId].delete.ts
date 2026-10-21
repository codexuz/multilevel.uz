// Takes a student out of the group (and frees their seat when no other group of the centre has them).
export default defineEventHandler(async (event) => {
  const { group } = await requireGroupStaff(event, String(getRouterParam(event, 'id')))
  await leaveGroup(group.id, String(getRouterParam(event, 'userId')))
  return { ok: true }
})
