// Opens sections for the room, or for the candidates named ({ skills, candidateIds?, open? }).
export default defineEventHandler(async (event) => {
  const { session } = await requireSession(event, String(getRouterParam(event, 'id')))
  return unlock(session, (await readBody(event)) ?? {})
})
