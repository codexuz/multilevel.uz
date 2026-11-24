import { randomBytes } from 'node:crypto'

/**
 * Connect Google Calendar (a signed-in teacher): Google asks them to let Mockmee add events to their
 * calendar, with lasting (offline) access, so each online class gets a Meet link
 * (google-calendar.ts). A state kept in a cookie makes sure the answer is to their own request.
 * ?next= is where they come back to.
 */
const STATE_COOKIE = 'ml_gcal_state'
const NEXT_COOKIE = 'ml_gcal_next'
const safeNext = (v: unknown) => (typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') ? v : '/classes')
const back = (next: string, result: string) => `${next}${next.includes('?') ? '&' : '?'}google=${result}`

export default defineEventHandler(async (event) => {
  const user = await optionalUser(event)
  if (!user) return sendRedirect(event, `/login?next=${encodeURIComponent('/classes')}`)
  const query = getQuery(event)
  const cookieOpts = { httpOnly: true, sameSite: 'lax' as const, secure: !import.meta.dev, path: '/auth/google-calendar', maxAge: 600 }

  // Starting: a fresh state, and where to come back to.
  if (!query.code && !query.error && !query.state) {
    const state = randomBytes(16).toString('hex')
    setCookie(event, STATE_COOKIE, state, cookieOpts)
    setCookie(event, NEXT_COOKIE, safeNext(query.next), cookieOpts)
    return sendRedirect(event, `/auth/google-calendar?state=${state}`)
  }

  const next = safeNext(getCookie(event, NEXT_COOKIE))
  if (query.error) return sendRedirect(event, back(next, 'cancelled'))
  // Google's answer must carry the state this browser was given.
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
