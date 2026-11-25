// My decks (teachers), newest first, with their cards and classes.
export default defineEventHandler(async (event) => {
  const user = await requireTeacher(event)
  return { decks: await teacherDecks(user.id), categories: DECK_CATEGORIES }
})
