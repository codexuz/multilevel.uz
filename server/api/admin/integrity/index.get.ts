// Candidates whose tests look wrong, to look at (?status=FLAGGED|WARNED|CLEARED|DISQUALIFIED|ALL, ?q=).
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const q = getQuery(event)
  return integrityQueue({ status: typeof q.status === 'string' ? q.status : undefined, search: typeof q.q === 'string' ? q.q : undefined })
})
