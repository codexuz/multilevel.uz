// Whether my Google Calendar is connected (for Meet links), and as which Google account.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const c = await connectionOf(user.id)
  const { clientId } = useRuntimeConfig().oauth?.google ?? {}
  return { available: !!clientId, connected: !!c, email: c?.googleEmail ?? null }
})
