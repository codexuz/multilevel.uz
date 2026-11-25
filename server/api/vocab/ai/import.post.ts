// Cards the AI finds in a pasted text: a word list, an article or notes (a draft to review): { text, level?, max? }.
export default defineEventHandler(async (event) => {
  const user = await requireTeacher(event)
  const b = (await readBody<{ text?: string, level?: string, max?: number }>(event)) ?? {}
  if (String(b.text ?? '').trim().length < 3) throw createError({ statusCode: 400, message: 'Paste a word list or a text' })
  return { cards: await extractCards(user.id, { text: String(b.text), level: b.level ?? null, max: Number(b.max) || 30 }) }
})
