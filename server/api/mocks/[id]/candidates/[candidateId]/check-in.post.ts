// Identity seen: a seat code (the first check-in spends a mock credit; again, a new code and the old seat ends).
export default defineEventHandler(async (event) => {
  const { session, user } = await requireSession(event, String(getRouterParam(event, 'id')))
  return checkIn(session, String(getRouterParam(event, 'candidateId')), user.id)
})
