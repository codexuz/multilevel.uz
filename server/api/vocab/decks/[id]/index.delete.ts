import { eq } from 'drizzle-orm'
import { vocabDecks } from '../../../../database/schema'

// Deletes a deck, its cards and its students' progress in it.
export default defineEventHandler(async (event) => {
  const { deck } = await requireDeckTeacher(event, String(getRouterParam(event, 'id')))
  await useDb().delete(vocabDecks).where(eq(vocabDecks.id, deck.id))
  return { ok: true }
})
