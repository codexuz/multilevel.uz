const PUBLIC_PATHS = new Set(['/', '/login', '/upgrade'])

export default defineNuxtRouteMiddleware(async (to) => {
  const { me, refresh } = useMe()
  if (me.value === undefined || me.value === null) await refresh()

  const isPublic = PUBLIC_PATHS.has(to.path)
  const user = me.value

  if (!user) {
    return isPublic ? undefined : navigateTo('/login')
  }

  // Signed in but hasn't completed onboarding.
  if (!user.onboarded && to.path !== '/onboarding' && !isPublic) {
    return navigateTo('/onboarding')
  }
  if (user.onboarded && to.path === '/onboarding') {
    return navigateTo('/dashboard')
  }
  if (to.path === '/login') {
    return navigateTo('/dashboard')
  }
})
