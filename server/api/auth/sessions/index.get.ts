import { and, eq, isNull, desc } from 'drizzle-orm'
import { sessions } from '../../../database/schema'
import { preferLanIpv4ForLoopback } from '../../../utils/ip'
import { REFRESH_COOKIE, verifyRefreshToken } from '../../../utils/jwt'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = useDb()

  let currentSid: string | null = null
  const rt = getCookie(event, REFRESH_COOKIE)
  if (rt) {
    try {
      currentSid = (await verifyRefreshToken(rt)).sid
    } catch {
      // Ignore invalid refresh cookies when listing sessions.
    }
  }

  const rows = await db.select().from(sessions)
    .where(and(eq(sessions.userId, user.id), isNull(sessions.revokedAt)))
    .orderBy(desc(sessions.lastSeenAt))

  return rows.map(s => ({
    id: s.id,
    deviceLabel: s.deviceLabel,
    userAgent: s.userAgent,
    ipAddress: preferLanIpv4ForLoopback(s.ipAddress),
    lastSeenAt: s.lastSeenAt,
    createdAt: s.createdAt,
    current: s.id === currentSid
  }))
})
