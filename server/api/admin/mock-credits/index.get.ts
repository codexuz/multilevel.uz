// A centre's or a teacher's mock credits (?centreId= or ?userId=).
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const q = getQuery(event)
  if (!q.centreId === !q.userId) throw createError({ statusCode: 400, message: 'Pick a centre or a teacher' })
  return { credits: await creditBalance(q.centreId ? { centreId: String(q.centreId) } : { centreId: null, userId: String(q.userId) }) }
})
