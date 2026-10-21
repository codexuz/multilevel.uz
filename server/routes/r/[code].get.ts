// An invite link, /r/<code>: remembered for 30 days, so the friend's account (made now or later
// on this device) counts as invited. Then on to the landing page.
export default defineEventHandler((event) => {
  const code = String(getRouterParam(event, 'code') ?? '').trim().toLowerCase()
  if (/^[a-z0-9]{6,12}$/.test(code)) {
    setCookie(event, REF_COOKIE, code, { path: '/', maxAge: 30 * 86_400, sameSite: 'lax', httpOnly: false, secure: !import.meta.dev })
  }
  return sendRedirect(event, '/?invited=1', 302)
})
