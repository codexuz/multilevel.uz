/**
 * The three parts of Mockmee, kept apart by the account's role: the Admin panel (admins), the
 * Teacher panel (teachers) and the student app (everyone else). Each part has its own pages and
 * home; a page of another part leads home instead. A few pages are shared: the test catalogue and a
 * test's page, the course catalogue and a course's pages (a teacher's preview), settings, sitting a
 * test, and the public pages; these show inside the viewer's own part.
 */
export type Area = 'admin' | 'teacher' | 'student'

export function areaOf(role: string | null | undefined): Area {
  if (role === 'admin') return 'admin'
  if (role === 'teacher' || role === 'center_owner') return 'teacher'
  return 'student'
}

export const AREA_HOME: Record<Area, string> = { admin: '/admin', teacher: '/teacher', student: '/dashboard' }

export const homeOf = (role: string | null | undefined) => AREA_HOME[areaOf(role)]

const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`)

/** Which part a page belongs to, or 'shared' for pages every part may open. */
export function areaOfPath(path: string): Area | 'staff' | 'shared' {
  if (under(path, '/admin') || under(path, '/builder')) return 'admin'
  if (under(path, '/marking')) return 'staff'
  if (under(path, '/teacher') || under(path, '/classes') || under(path, '/mocks') || under(path, '/courses/manage')) return 'teacher'
  // The list of results is the student's; a single result (and its review) is shared, as teachers and admins open their students'.
  if (path === '/dashboard' || path === '/results' || under(path, '/words') || path === '/online' || path === '/earn'
    || path === '/live' || path === '/seat' || under(path, '/join') || path === '/profile' || under(path, '/packs')
    || under(path, '/feedback') || under(path, '/billing')) return 'student'
  return 'shared'
}

/** Whether an account of this role may open the page. Admins may also look into teachers' classes and courses. */
export function mayOpen(role: string | null | undefined, path: string) {
  const area = areaOf(role)
  const page = areaOfPath(path)
  if (page === 'shared') return true
  if (page === 'staff') return area !== 'student'
  if (page === area) return true
  return area === 'admin' && (under(path, '/courses/manage') || /^\/classes\/[^/]+\/?$/.test(path))
}

/** A path to go back to after signing in, if it is one this role may open; else the role's home. */
export function landingFor(role: string | null | undefined, next: string | null | undefined) {
  const ok = !!next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/auth/') && next !== '/' && !next.startsWith('/login')
  return ok && mayOpen(role, next!.split('?')[0]!) ? next! : homeOf(role)
}
