// Merges the account the token names into the signed-in one.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ token?: string }>(event)
  const otherId = accountToMerge(String(body?.token ?? ''), user.id)
  if (!otherId) throw createError({ statusCode: 403, message: 'This link has expired or was made for a different account. Start again from the account you want to keep.' })
  await mergeAccounts(user.id, otherId)
  return { ok: true }
})
