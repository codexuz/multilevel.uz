import { and, eq } from 'drizzle-orm'
import { sessions } from '../../database/schema'
import { REFRESH_COOKIE, verifyRefreshToken } from '../../utils/jwt'

// Register the caller's FCM token onto their current device session.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ token?: string }>(event)
  if (!body.token) throw createError({ statusCode: 400, message: 'token required' })

  const rt = getCookie(event, REFRESH_COOKIE)
  if (!rt) throw createError({ statusCode: 400, message: 'No active session' })

  let claims
  try {
    claims = await verifyRefreshToken(rt)
  } catch {
    throw createError({ statusCode: 401, message: 'Invalid session' })
  }

  const db = useDb()
  await db.update(sessions)
    .set({ fcmToken: body.token, lastSeenAt: new Date() })
    .where(and(eq(sessions.id, claims.sid), eq(sessions.userId, user.id)))

  return { ok: true }
})
