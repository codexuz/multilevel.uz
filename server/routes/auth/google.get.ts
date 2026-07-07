import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { users, sessions } from '../../database/schema'
import { getClientIpAddress } from '../../utils/ip'
import { signAccessToken, signRefreshToken, setAuthCookies, REFRESH_TTL_SECONDS } from '../../utils/jwt'

interface GoogleUser { email: string, name?: string, picture?: string, sub?: string }

function deviceLabelFromUA(ua?: string): string {
  if (!ua) return 'Unknown device'
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  return `${browser} on ${os}`
}

export default defineOAuthGoogleEventHandler({
  config: { scope: ['email', 'profile'] },
  async onSuccess(event, { user }) {
    const g = user as GoogleUser
    if (!g.email) throw createError({ statusCode: 400, message: 'Google account has no email' })

    const db = useDb()

    // Upsert user by email
    let [row] = await db.select().from(users).where(eq(users.email, g.email)).limit(1)
    if (!row) {
      [row] = await db.insert(users).values({
        email: g.email,
        name: g.name ?? null,
        avatarUrl: g.picture ?? null
      }).returning()
    } else if ((g.name && g.name !== row.name) || (g.picture && g.picture !== row.avatarUrl)) {
      [row] = await db.update(users)
        .set({ name: g.name ?? row.name, avatarUrl: g.picture ?? row.avatarUrl, updatedAt: new Date() })
        .where(eq(users.id, row.id)).returning()
    }

    const ua = getRequestHeader(event, 'user-agent')
    const ip = getClientIpAddress(event)

    const [session] = await db.insert(sessions).values({
      userId: row!.id,
      userAgent: ua ?? null,
      deviceLabel: deviceLabelFromUA(ua),
      ipAddress: ip,
      expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000)
    }).returning()

    const access = await signAccessToken(row!.id, row!.role, randomUUID())
    const refresh = await signRefreshToken(row!.id, session!.id)
    setAuthCookies(event, access, refresh)

    return sendRedirect(event, row!.onboarded ? '/dashboard' : '/onboarding')
  },
  onError(event, error) {
    console.error('Google OAuth error:', error)
    return sendRedirect(event, '/login?error=oauth')
  }
})
