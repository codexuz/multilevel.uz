// Anyone can look around: the home page, the catalogue and each test's page, Premium and the other
// open pages. Sitting a test (its papers, result and review) needs sign-in, as do results kept,
// the profile, settings and the staff/teacher panels.
const isPublic = (path: string) => path === '/' || path === '/login' || path === '/earn' || path === '/teach' || path === '/courses' || /^\/courses\/(?!manage(\/|$))[^/]+\/?$/.test(path) || path === '/live' || path.startsWith('/join/') || path.startsWith('/share/') || path === '/tests' || path === '/packs' || /^\/packs\/[^/]+\/?$/.test(path) || /^\/tests\/[^/]+\/?$/.test(path) || /^\/(listening|reading|writing)(\/[^/]+)?\/?$/.test(path) || path === '/seat' || path.startsWith('/report/')

const isAdminPanelPath = (path: string) => path === '/admin' || path.startsWith('/admin/') || path === '/builder' || path.startsWith('/builder/')
const isTeacherPanelPath = (path: string) => path === '/teacher' || path.startsWith('/teacher/') || path === '/classes' || path.startsWith('/classes/') || path === '/mocks' || path.startsWith('/mocks/')

export default defineNuxtRouteMiddleware(async (to) => {
  const { me, refresh } = useMe()
  if (me.value === undefined || me.value === null) await refresh()
  const user = me.value

  // Route-level panel layout splitting: Admin Panel, Teacher Panel, and Student View are strictly separated.
  if (to.meta.guestLayout) {
    setPageLayout(user ? 'default' : 'public')
  } else if (isAdminPanelPath(to.path)) {
    setPageLayout('admin')
  } else if (isTeacherPanelPath(to.path)) {
    setPageLayout('teacher')
  } else if (to.path === '/marking' || to.path.startsWith('/marking/')) {
    setPageLayout(user?.role === 'admin' ? 'admin' : 'teacher')
  } else if (to.path === '/courses/manage' || to.path.startsWith('/courses/manage/')) {
    setPageLayout(to.query.panel === 'admin' && user?.role === 'admin' ? 'admin' : 'teacher')
  }

  if (!user) return isPublic(to.path) ? undefined : navigateTo(`/login?next=${encodeURIComponent(to.fullPath)}`)

  // A walk-in's account sits its mock session at the seat, and goes nowhere else.
  if (user.mockOnly) return to.path === '/seat' || /^\/tests\/[^/]+\/[a-z]+\/?$/.test(to.path) ? undefined : navigateTo('/seat')

  const next = to.path === '/login'
    ? (typeof to.query.next === 'string' && to.query.next.startsWith('/') && !to.query.next.startsWith('//')
        ? to.query.next
        : user.role === 'admin' ? '/admin' : (user.role === 'teacher' || user.teaches) ? '/teacher' : '/dashboard')
    : to.fullPath
  // Staff and teachers are let be: they work on both exams (and may set theirs in Settings).
  const needsOnboarding = (!user.onboarded || !user.exam) && user.role === 'student'
  const letThrough = to.path === '/onboarding' || to.path === '/account/merge' || to.path.startsWith('/join/') || to.path.startsWith('/billing/') || to.path.startsWith('/share/')
  if (needsOnboarding && !letThrough) return navigateTo(`/onboarding${next === '/' || next === '/dashboard' || next === '/tests' ? '' : `?next=${encodeURIComponent(next)}`}`)
  if (!needsOnboarding && to.path === '/onboarding') return navigateTo('/dashboard')
  if (to.path === '/login') return navigateTo(next)
})
