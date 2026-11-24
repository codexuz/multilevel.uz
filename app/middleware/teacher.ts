// Route middleware: teacher panel pages (teachers, center owners, admins, or users with classes).
export default defineNuxtRouteMiddleware(async () => {
  const { me, refresh } = useMe()
  if (!me.value) await refresh()
  if (!me.value) return navigateTo('/login')
  const ok = me.value.role === 'teacher' || me.value.role === 'center_owner' || me.value.role === 'admin' || !!me.value.teaches || !!me.value.runsMocks
  if (!ok) return navigateTo('/dashboard')
})
