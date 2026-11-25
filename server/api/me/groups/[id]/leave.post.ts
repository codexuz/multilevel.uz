// Leaves one of my groups.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { g } = await requireMyGroup(user.id, String(getRouterParam(event, 'id')))
  await leaveClass(g.id, user.id)
  return { ok: true }
})
