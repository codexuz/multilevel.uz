// A deck with its cards and the classes it is set to (its teacher).
export default defineEventHandler(async (event) => {
  const { deck } = await requireDeckTeacher(event, String(getRouterParam(event, 'id')))
  return await deckWithCards(deck)
})
