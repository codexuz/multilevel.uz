// Exact matches only: `/courses` and `/tests` are browsable catalogs, but the
// detail routes beneath them (`/courses/:id`, `/tests/:id`) stay protected.
const PUBLIC_PATHS = new Set(['/', '/login', '/upgrade', '/courses', '/tests'])

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
