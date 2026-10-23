// Signs the account out on every device, so whoever shares it has to sign in again.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return signOutEverywhere(String(getRouterParam(event, 'userId')))
})
