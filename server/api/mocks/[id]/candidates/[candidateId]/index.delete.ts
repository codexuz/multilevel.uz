// Takes a candidate out before they hand anything in (a credit spent on them comes back).
export default defineEventHandler(async (event) => {
  const { session, user } = await requireSession(event, String(getRouterParam(event, 'id')))
  return removeCandidate(session, String(getRouterParam(event, 'candidateId')), user.id)
})
