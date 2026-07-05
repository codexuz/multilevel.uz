import { eq } from 'drizzle-orm'
import { sessions, revokedTokens } from '../../database/schema'
import {
  ACCESS_COOKIE, REFRESH_COOKIE, verifyAccessToken, verifyRefreshToken, clearAuthCookies
} from '../../utils/jwt'

export default defineEventHandler(async (event) => {
  const db = useDb()

  // Blacklist the current access token (by jti) until it would expire (~15m).
  const at = getCookie(event, ACCESS_COOKIE)
  if (at) {
    try {
      const claims = await verifyAccessToken(at)
      await db.insert(revokedTokens)
        .values({ jti: claims.jti, expiresAt: new Date(Date.now() + 60 * 15 * 1000) })
        .onConflictDoNothing()
    } catch { /* already invalid */ }
  }

  // Revoke the device session.
  const rt = getCookie(event, REFRESH_COOKIE)
  if (rt) {
    try {
      const { sid } = await verifyRefreshToken(rt)
      await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sid))
    } catch { /* ignore */ }
  }

  clearAuthCookies(event)
  return { ok: true }
})
