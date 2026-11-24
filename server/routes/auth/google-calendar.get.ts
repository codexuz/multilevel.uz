import { randomBytes } from 'node:crypto'

/**
 * Admin-only Google Calendar OAuth connection: a single admin connects their Google account
 * (/auth/google-calendar) so all teachers' online classes generate Meet links through that
 * shared account without needing every teacher approved on Google's OAuth consent screen.
 */
const STATE_COOKIE = 'ml_gcal_state'
const NEXT_COOKIE = 'ml_gcal_next'
const safeNext = (v: unknown) => (typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') ? v : '/admin/settings')
const back = (next: string, result: string) => `${next}${next.includes('?') ? '&' : '?'}google=${result}`

export default defineEventHandler(async (event) => {
  const user = await optionalUser(event)
  if (!user) return sendRedirect(event, `/login?next=${encodeURIComponent('/admin/settings')}`)
  if (user.role !== 'admin') throw createError({ statusCode: 403, message: 'Only admins can connect the platform Google Calendar account.' })

  const query = getQuery(event)
  const cookieOpts = { httpOnly: true, sameSite: 'lax' as const, secure: !import.meta.dev, path: '/auth/google-calendar', maxAge: 600 }

  if (!query.code && !query.error && !query.state) {
    const state = randomBytes(16).toString('hex')
    setCookie(event, STATE_COOKIE, state, cookieOpts)
    setCookie(event, NEXT_COOKIE, safeNext(query.next), cookieOpts)
    return sendRedirect(event, `/auth/google-calendar?state=${state}`)
  }

  const next = safeNext(getCookie(event, NEXT_COOKIE))
  if (query.error) return sendRedirect(event, back(next, 'cancelled'))
  if (query.code && (!query.state || query.state !== getCookie(event, STATE_COOKIE))) return sendRedirect(event, back(next, 'failed'))

  const site = String(useRuntimeConfig().public.siteUrl || getRequestURL(event).origin).replace(/\/$/, '')
  return defineOAuthGoogleEventHandler({
    config: {
      scope: ['openid', 'email', CALENDAR_SCOPE],
      authorizationParams: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' },
      redirectURL: `${site}/auth/google-calendar`,
      tokenURL: tokenUrl(),
      ...(process.env.GOOGLE_USERINFO_URL ? { userURL: process.env.GOOGLE_USERINFO_URL } : {})
    },
    async onSuccess(ev, { user: g, tokens }) {
      deleteCookie(ev, STATE_COOKIE, cookieOpts)
      deleteCookie(ev, NEXT_COOKIE, cookieOpts)
      try {
        await saveConnection(user.id, tokens, (g as { email?: string }).email ?? null)
      } catch (e: any) {
        console.warn('[google-calendar] not connected:', e?.message)
        return sendRedirect(ev, back(next, 'scope'))
      }
      return sendRedirect(ev, back(next, 'connected'))
    },
    onError(ev, error) {
      console.error('[google-calendar] OAuth error:', error)
      return sendRedirect(ev, back(next, 'failed'))
    }
  })(event)
})
