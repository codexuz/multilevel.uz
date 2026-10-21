// An invite link, /r/<code>: remembered for 30 days, so the friend's account (made now or later
// on this device) counts as invited. Then on to the landing page, or to ?to=<path> on this site
// (a shared result points at its test).
export default defineEventHandler((event) => {
  const code = String(getRouterParam(event, 'code') ?? '').trim().toLowerCase()
  if (/^[a-z0-9]{6,12}$/.test(code)) {
    setCookie(event, REF_COOKIE, code, { path: '/', maxAge: 30 * 86_400, sameSite: 'lax', httpOnly: false, secure: !import.meta.dev })
  }
  const to = String(getQuery(event).to ?? '')
  const path = to.startsWith('/') && !to.startsWith('//') ? to : '/'
  return sendRedirect(event, `${path}${path.includes('?') ? '&' : '?'}invited=1`, 302)
})
