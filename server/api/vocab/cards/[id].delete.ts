import { eq } from 'drizzle-orm'
import { vocabCards } from '../../../database/schema'

// Deletes a card (its deck's teacher).
export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id'))
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 404, message: 'Card not found' })
  const [card] = await useDb().select({ deckId: vocabCards.deckId }).from(vocabCards).where(eq(vocabCards.id, id)).limit(1)
  if (!card) throw createError({ statusCode: 404, message: 'Card not found' })
  await requireDeckTeacher(event, card.deckId)
  await useDb().delete(vocabCards).where(eq(vocabCards.id, id))
  return { ok: true }
})
