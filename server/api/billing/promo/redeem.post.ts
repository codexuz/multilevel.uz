// A code for days of Premium, used on its own.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ code?: string }>(event)
  return redeemDaysCode(user.id, body?.code)
})
