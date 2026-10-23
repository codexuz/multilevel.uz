// A candidate's details fixed at the desk: name, phone, ID number, the fee taken.
export default defineEventHandler(async (event) => {
  const { session } = await requireSession(event, String(getRouterParam(event, 'id')))
  return updateCandidate(session, String(getRouterParam(event, 'candidateId')), (await readBody(event)) ?? {})
})
