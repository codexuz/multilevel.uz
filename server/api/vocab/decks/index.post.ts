import { vocabDecks } from '../../../database/schema'

// A new deck: { title, description?, category?, topic?, level? }.
export default defineEventHandler(async (event) => {
  const user = await requireTeacher(event)
  const v = deckValues((await readBody(event)) ?? {}, false)
  const [deck] = await useDb().insert(vocabDecks).values({ ...v, title: v.title!, teacherId: user.id }).returning()
  return deck
})
