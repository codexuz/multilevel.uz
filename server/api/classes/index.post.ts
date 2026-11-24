// A new class of mine (making me a teacher the first time): its join link is ready to share.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const name = String((await readBody<{ name?: string }>(event))?.name ?? '')
  const g = await createClass(user.id, name)
  return { id: g.id, name: g.name, joinCode: g.joinCode }
})
