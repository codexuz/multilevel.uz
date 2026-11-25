import { eq } from 'drizzle-orm'
import { vocabCards } from '../../../database/schema'

// Cards made by the AI for a topic (a draft to review): { topic, level?, count?, category?, deckId? (to skip its words) }.
export default defineEventHandler(async (event) => {
  const user = await requireTeacher(event)
  const b = (await readBody<{ topic?: string, level?: string, count?: number, category?: string, deckId?: string }>(event)) ?? {}
  if (!String(b.topic ?? '').trim()) throw createError({ statusCode: 400, message: 'Name the topic' })
  let avoid: string[] = []
  if (b.deckId) {
    const { deck } = await requireDeckTeacher(event, String(b.deckId))
    avoid = (await useDb().select({ term: vocabCards.term }).from(vocabCards).where(eq(vocabCards.deckId, deck.id))).map(c => c.term)
  }
  return { cards: await generateCards(user.id, { topic: String(b.topic), level: b.level ?? null, count: Number(b.count) || 15, category: b.category ?? null, avoid }) }
})
