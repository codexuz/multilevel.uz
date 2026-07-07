import { randomUUID } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import { users, sessions } from '../../database/schema'
import { getClientIpAddress } from '../../utils/ip'
import {
  REFRESH_COOKIE, verifyRefreshToken, signAccessToken, signRefreshToken,
  setAuthCookies, clearAuthCookies
} from '../../utils/jwt'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, REFRESH_COOKIE)
  if (!token) throw createError({ statusCode: 401, message: 'No refresh token' })

  let claims
  try {
    claims = await verifyRefreshToken(token)
  } catch {
    clearAuthCookies(event)
    throw createError({ statusCode: 401, message: 'Invalid refresh token' })
  }

  const db = useDb()
  const [session] = await db.select().from(sessions)
    .where(and(eq(sessions.id, claims.sid), isNull(sessions.revokedAt)))
    .limit(1)

  if (!session || session.userId !== claims.sub || session.expiresAt < new Date()) {
    clearAuthCookies(event)
    throw createError({ statusCode: 401, message: 'Session expired' })
  }

  const [user] = await db.select().from(users).where(eq(users.id, claims.sub)).limit(1)
  if (!user) {
    clearAuthCookies(event)
    throw createError({ statusCode: 401, message: 'User not found' })
  }

  const ip = getClientIpAddress(event) ?? session.ipAddress
  await db.update(sessions).set({ lastSeenAt: new Date(), ipAddress: ip }).where(eq(sessions.id, session.id))

  const access = await signAccessToken(user.id, user.role, randomUUID())
  const refresh = await signRefreshToken(user.id, session.id)
  setAuthCookies(event, access, refresh)

  return { ok: true }
})
