// Returns a vocabulary deck's full word list and the student's mastery progress per card.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const deck = await requireStudentDeck(user.id, String(getRouterParam(event, 'id')))
  return studentDeckDetail(user.id, deck)
})
