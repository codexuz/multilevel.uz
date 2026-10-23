// A new mock session: a test, a time and a room; walk-ins pay at the desk; results held until announced.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return createSession(user, (await readBody(event)) ?? {})
})
