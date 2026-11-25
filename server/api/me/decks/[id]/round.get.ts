// A round of a deck to play: due cards first, then new ones.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const deck = await requireStudentDeck(user.id, String(getRouterParam(event, 'id')))
  return await studyRound(user.id, deck)
})
