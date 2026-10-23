// What the exam page sees, as it goes: the section on screen and the integrity notes, for the board.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return ping(user.id, (await readBody(event)) ?? {})
})
