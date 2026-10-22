// Anyone can look around: the home page, the catalogue and each test's page, Premium and the other
// open pages. Sitting a test (its papers, result and review) needs sign-in, as do results kept,
// the profile, settings and the staff pages.
const isPublic = (path: string) => path === '/' || path === '/login' || path === '/pricing' || path === '/earn' || path === '/promo' || path === '/centres' || path === '/centres/apply' || path === '/live' || path.startsWith('/join/') || path.startsWith('/share/') || path === '/tests' || /^\/tests\/[^/]+\/?$/.test(path)

export default defineNuxtRouteMiddleware(async (to) => {
  const { me, refresh } = useMe()
  if (me.value === undefined || me.value === null) await refresh()
  const user = me.value

  // Pages that are the public site for guests and part of the app for the signed in.
  if (to.meta.guestLayout) setPageLayout(user ? 'default' : 'public')

  if (!user) return isPublic(to.path) ? undefined : navigateTo(`/login?next=${encodeURIComponent(to.fullPath)}`)

  // Signed in but hasn't completed onboarding: asked once, outside the open pages.
  // (Combining with an older account comes first: that account may be onboarded already.)
  if (!user.onboarded && to.path !== '/onboarding' && to.path !== '/account/merge' && !isPublic(to.path)) return navigateTo('/onboarding')
  if (user.onboarded && to.path === '/onboarding') return navigateTo('/results')
  if (to.path === '/login') return navigateTo(typeof to.query.next === 'string' && to.query.next.startsWith('/') ? to.query.next : '/tests')
})
