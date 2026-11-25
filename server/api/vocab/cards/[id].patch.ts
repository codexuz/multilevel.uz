import { eq } from 'drizzle-orm'
import { vocabCards } from '../../../database/schema'

// Changes a card (its deck's teacher).
export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id'))
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 404, message: 'Card not found' })
  const [card] = await useDb().select({ deckId: vocabCards.deckId }).from(vocabCards).where(eq(vocabCards.id, id)).limit(1)
  if (!card) throw createError({ statusCode: 404, message: 'Card not found' })
  await requireDeckTeacher(event, card.deckId)
  const v = cardValues((await readBody(event)) ?? {}, true)
  const [row] = await useDb().update(vocabCards).set({ ...v, updatedAt: new Date() }).where(eq(vocabCards.id, id)).returning()
  return row
})
