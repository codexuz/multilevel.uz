/**
 * A quiz on my saved words: fill the gap in my own sentence, or pick the meaning from four
 * (?mode=mix|gap|meaning, ?limit= up to 20, ?locale= for translations). See word-quiz.ts.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const mode = isQuizMode(query.mode) ? query.mode : 'mix'
  const limit = Math.min(20, Math.max(1, Math.floor(Number(query.limit) || 10)))
  const locale = isWordLocale(query.locale) ? query.locale : 'en'
  return { mode, ...(await buildQuiz(user.id, mode, limit, locale)) }
})
