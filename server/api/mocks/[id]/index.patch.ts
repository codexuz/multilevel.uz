// Changes a session: its title, time, room, seats, price, holding results, or archives it.
export default defineEventHandler(async (event) => {
  const { session } = await requireSession(event, String(getRouterParam(event, 'id')))
  return updateSession(session, (await readBody(event)) ?? {})
})
