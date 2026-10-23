// Adds candidates: a walk-in registered at the desk (`walkIn`), or the centre's students (`studentIds`).
export default defineEventHandler(async (event) => {
  const { session } = await requireSession(event, String(getRouterParam(event, 'id')))
  const body = (await readBody<{ walkIn?: Record<string, any>, studentIds?: string[] }>(event)) ?? {}
  if (body.walkIn) return addWalkIn(session, body.walkIn)
  return addStudents(session, Array.isArray(body.studentIds) ? body.studentIds : [])
})
