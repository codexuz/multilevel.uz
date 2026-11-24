// Route middleware: Teacher panel pages: teachers (and admins, who may look into them).
export default defineNuxtRouteMiddleware(async () => {
  const { me, refresh } = useMe()
  if (!me.value) await refresh()
  if (!me.value) return navigateTo('/login')
  if (areaOf(me.value.role) === 'student') return navigateTo('/dashboard')
})
