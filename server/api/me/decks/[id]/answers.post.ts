// A round's answers: { answers: [{ cardId, correct }] }; moves each card on its schedule and gives XP.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const deck = await requireStudentDeck(user.id, String(getRouterParam(event, 'id')))
  const answers = (await readBody<{ answers?: { cardId?: unknown, correct?: unknown }[] }>(event))?.answers
  if (!Array.isArray(answers)) throw createError({ statusCode: 400, message: 'answers: a list' })
  return await recordAnswers(user.id, deck, answers.slice(0, 100).map(a => ({ cardId: String(a?.cardId), correct: a?.correct === true })))
})
