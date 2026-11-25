// The decks my teachers set my classes, with how far I am in each.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return { decks: await studentDecks(user.id) }
})
