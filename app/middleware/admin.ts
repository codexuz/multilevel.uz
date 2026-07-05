// Route middleware: admin-only pages.
export default defineNuxtRouteMiddleware(async () => {
  const { me, isAdmin, refresh } = useMe()
  if (!me.value) await refresh()
  if (!me.value) return navigateTo('/login')
  if (!isAdmin.value) return navigateTo('/dashboard')
})
