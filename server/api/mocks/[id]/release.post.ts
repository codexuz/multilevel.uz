// Announces the results: of the candidates named, or every one whose marks are complete.
export default defineEventHandler(async (event) => {
  const { session } = await requireSession(event, String(getRouterParam(event, 'id')))
  const body = (await readBody<{ candidateIds?: string[] }>(event).catch(() => null)) ?? {}
  return release(session, Array.isArray(body.candidateIds) ? body.candidateIds.map(String) : undefined)
})
