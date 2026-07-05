// Route middleware: gate admin/examiner pages.
export default defineNuxtRouteMiddleware(async () => {
  const { me, isStaff, refresh } = useMe()
  if (!me.value) await refresh()
  if (!me.value) return navigateTo('/login')
  if (!isStaff.value) return navigateTo('/dashboard')
})
