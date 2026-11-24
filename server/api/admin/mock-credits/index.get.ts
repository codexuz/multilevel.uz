// A teacher's mock credits (?userId=).
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const q = getQuery(event)
  if (!q.userId) throw createError({ statusCode: 400, message: 'Pick a teacher' })
  return { credits: await creditBalance(String(q.userId)) }
})
