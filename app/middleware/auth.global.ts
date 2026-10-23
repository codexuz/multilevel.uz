// Anyone can look around: the home page, the catalogue and each test's page, Premium and the other
// open pages. Sitting a test (its papers, result and review) needs sign-in, as do results kept,
// the profile, settings and the staff pages.
const isPublic = (path: string) => path === '/' || path === '/login' || path === '/pricing' || path === '/earn' || path === '/promo' || path === '/centres' || path === '/live' || path.startsWith('/join/') || path.startsWith('/share/') || path === '/tests' || path === '/packs' || /^\/packs\/[^/]+\/?$/.test(path) || /^\/tests\/[^/]+\/?$/.test(path) || /^\/(listening|reading|writing)(\/[^/]+)?\/?$/.test(path) || path === '/seat' || path.startsWith('/report/')

export default defineNuxtRouteMiddleware(async (to) => {
  const { me, refresh } = useMe()
  if (me.value === undefined || me.value === null) await refresh()
  const user = me.value

  // Pages that are the public site for guests and part of the app for the signed in.
  if (to.meta.guestLayout) setPageLayout(user ? 'default' : 'public')

  if (!user) return isPublic(to.path) ? undefined : navigateTo(`/login?next=${encodeURIComponent(to.fullPath)}`)

  // A walk-in's account sits its mock session at the seat, and goes nowhere else.
  if (user.mockOnly) return to.path === '/seat' || /^\/tests\/[^/]+\/[a-z]+\/?$/.test(to.path) ? undefined : navigateTo('/seat')

  // Signed in without an exam chosen (or onboarding not finished): onboarding comes first, wherever
  // they were going, and brings them back there. A few pages are let through: combining with an
  // older account (it may be onboarded already), joining a class, a payment coming back, a share.
  const next = to.path === '/login'
    ? (typeof to.query.next === 'string' && to.query.next.startsWith('/') && !to.query.next.startsWith('//') ? to.query.next : '/tests')
    : to.fullPath
  // Staff are let be: they work on both exams (and may set theirs in Settings).
  const needsOnboarding = (!user.onboarded || !user.exam) && user.role === 'student'
  const letThrough = to.path === '/onboarding' || to.path === '/account/merge' || to.path.startsWith('/join/') || to.path.startsWith('/billing/') || to.path.startsWith('/share/')
  if (needsOnboarding && !letThrough) return navigateTo(`/onboarding${next === '/' || next === '/tests' ? '' : `?next=${encodeURIComponent(next)}`}`)
  if (!needsOnboarding && to.path === '/onboarding') return navigateTo('/tests')
  if (to.path === '/login') return navigateTo(next)
})
