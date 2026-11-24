// Anyone can look around: the home page, the catalogue and each test's page, the course catalogue
// and a course's page, and the other open pages. Everything else needs sign-in.
const isPublic = (path: string) => path === '/' || path === '/login' || path === '/earn' || path === '/teach' || path === '/courses' || /^\/courses\/(?!manage(\/|$))[^/]+\/?$/.test(path) || path === '/live' || path.startsWith('/join/') || path.startsWith('/share/') || path === '/tests' || path === '/packs' || /^\/packs\/[^/]+\/?$/.test(path) || /^\/tests\/[^/]+\/?$/.test(path) || /^\/(listening|reading|writing)(\/[^/]+)?\/?$/.test(path) || path === '/seat' || path.startsWith('/report/')

// Pages with a frame of their own (sitting a test, signing in, onboarding) keep it.
const OWN_LAYOUTS = new Set(['exam', 'onboarding', 'public'])

/**
 * The Admin panel, the Teacher panel and the student app are kept apart by role (shared/utils/areas.ts):
 * a page of another part leads to the account's own home, and a shared page (the catalogues, a
 * course, settings) shows inside the account's own part.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { me, refresh } = useMe()
  if (me.value === undefined || me.value === null) await refresh()
  const user = me.value

  if (!user) {
    if (to.meta.guestLayout) setPageLayout('public')
    return isPublic(to.path) ? undefined : navigateTo(`/login?next=${encodeURIComponent(to.fullPath)}`)
  }

  // A walk-in's account sits its mock session at the seat, and goes nowhere else.
  if (user.mockOnly) return to.path === '/seat' || /^\/tests\/[^/]+\/[a-z]+\/?$/.test(to.path) ? undefined : navigateTo('/seat')

  const area = areaOf(user.role)
  const home = AREA_HOME[area]

  // Signed in: the way in and the home page lead to the account's own home (or where sign-in was asked from).
  if (to.path === '/login') return navigateTo(landingFor(user.role, typeof to.query.next === 'string' ? to.query.next : null))

  // Students choose their exam first: onboarding comes before anything else, and brings them back.
  const needsOnboarding = area === 'student' && (!user.onboarded || !user.exam)
  const letThrough = to.path === '/onboarding' || to.path === '/account/merge' || to.path.startsWith('/join/') || to.path.startsWith('/billing/') || to.path.startsWith('/share/')
  if (needsOnboarding && !letThrough) return navigateTo(`/onboarding${to.path === '/' || to.fullPath === home ? '' : `?next=${encodeURIComponent(to.fullPath)}`}`)
  if (!needsOnboarding && to.path === '/onboarding') return navigateTo(home)

  if (to.path === '/') return navigateTo(home)
  if (!mayOpen(user.role, to.path)) return navigateTo(home)

  const layout = typeof to.meta.layout === 'string' ? to.meta.layout : null
  if (to.meta.layout === false || (layout && OWN_LAYOUTS.has(layout) && !to.meta.guestLayout)) return
  setPageLayout(area === 'admin' ? 'admin' : area === 'teacher' ? 'teacher' : 'default')
})
