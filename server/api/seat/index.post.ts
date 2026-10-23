// A seat code typed at a room computer: signs the candidate in for their mock session.
export default defineEventHandler(async (event) => {
  const body = (await readBody<{ code?: string }>(event)) ?? {}
  return takeSeat(event, String(body.code ?? '').replace(/\D/g, ''))
})
