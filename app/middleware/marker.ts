// Route middleware: the marking pages: admins, markers, and centres' owners and teachers.
export default defineNuxtRouteMiddleware(async () => {
  const { me, canMark, refresh } = useMe()
  if (!me.value) await refresh()
  if (!me.value) return navigateTo('/login')
  if (!canMark.value) return navigateTo('/tests')
})
