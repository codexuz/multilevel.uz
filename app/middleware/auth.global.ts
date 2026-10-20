// The site is open: the home page, the catalog, every test, its papers, a guest's result and Premium
// need no sign-in. Results kept, the profile, settings and the staff pages do.
const isPublic = (path: string) => path === '/' || path === '/login' || path === '/pricing' || path === '/tests' || path.startsWith('/tests/')

export default defineNuxtRouteMiddleware(async (to) => {
  const { me, refresh } = useMe()
  if (me.value === undefined || me.value === null) await refresh()
  const user = me.value

  // Pages that are the public site for guests and part of the app for the signed in.
  if (to.meta.guestLayout) setPageLayout(user ? 'default' : 'public')

  if (!user) return isPublic(to.path) ? undefined : navigateTo(`/login?next=${encodeURIComponent(to.fullPath)}`)

  // Signed in but hasn't completed onboarding: asked once, outside the open pages.
  if (!user.onboarded && to.path !== '/onboarding' && !isPublic(to.path)) return navigateTo('/onboarding')
  if (user.onboarded && to.path === '/onboarding') return navigateTo('/results')
  if (to.path === '/login') return navigateTo(typeof to.query.next === 'string' && to.query.next.startsWith('/') ? to.query.next : '/tests')
})
