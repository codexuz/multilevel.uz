import { eq } from 'drizzle-orm'
import { vocabDecks } from '../../../../database/schema'

// Changes a deck's title, description, category, topic or level.
export default defineEventHandler(async (event) => {
  const { deck } = await requireDeckTeacher(event, String(getRouterParam(event, 'id')))
  const v = deckValues((await readBody(event)) ?? {}, true)
  const [row] = await useDb().update(vocabDecks).set({ ...v, updatedAt: new Date() }).where(eq(vocabDecks.id, deck.id)).returning()
  return row
})
