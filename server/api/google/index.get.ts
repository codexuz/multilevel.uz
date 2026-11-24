// Whether the shared platform admin Google Calendar is connected for Google Meet links.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const c = await platformConnection()
  const { clientId } = useRuntimeConfig().oauth?.google ?? {}
  return {
    available: !!clientId,
    connected: !!c,
    email: user.role === 'admin' ? (c?.googleEmail ?? null) : null,
    canManage: user.role === 'admin'
  }
})
