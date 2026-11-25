// Adds cards to a deck: { cards: [{ term, definition, partOfSpeech?, ipa?, example?, translationUz?, translationRu? }] }.
export default defineEventHandler(async (event) => {
  const { deck } = await requireDeckTeacher(event, String(getRouterParam(event, 'id')))
  const cards = (await readBody<{ cards?: unknown }>(event))?.cards
  if (!Array.isArray(cards) || !cards.length) throw createError({ statusCode: 400, message: 'cards: a list' })
  return { added: await addCards(deck, cards as Record<string, unknown>[]) }
})
