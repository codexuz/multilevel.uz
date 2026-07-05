import { and, inArray, isNull, isNotNull, eq } from 'drizzle-orm'
import { sessions } from '../database/schema'

let _app: import('firebase-admin/app').App | null = null
let _initTried = false

async function getMessaging() {
  if (!_initTried) {
    _initTried = true
    const cfg = useRuntimeConfig()
    const projectId = cfg.firebaseProjectId
    const clientEmail = cfg.firebaseClientEmail
    const privateKey = (cfg.firebasePrivateKey as string | undefined)?.replace(/\\n/g, '\n')
    if (projectId && clientEmail && privateKey) {
      const { initializeApp, getApps, cert } = await import('firebase-admin/app')
      _app = getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
    }
  }
  if (!_app) return null
  const { getMessaging } = await import('firebase-admin/messaging')
  return getMessaging(_app)
}

export interface PushPayload {
  title: string
  body: string
  data?: Record<string, string>
}

/**
 * Send a push to every non-revoked device session belonging to the given users.
 * Silently no-ops if Firebase admin credentials aren't configured. Prunes tokens
 * that FCM reports as unregistered.
 */
export async function sendPush(userIds: string[], payload: PushPayload) {
  if (!userIds.length) return
  const messaging = await getMessaging()
  if (!messaging) return

  const db = useDb()
  const rows = await db.select({ token: sessions.fcmToken }).from(sessions)
    .where(and(
      inArray(sessions.userId, userIds),
      isNull(sessions.revokedAt),
      isNotNull(sessions.fcmToken)
    ))
  const tokens = [...new Set(rows.map(r => r.token!).filter(Boolean))]
  if (!tokens.length) return

  const res = await messaging.sendEachForMulticast({
    tokens,
    notification: { title: payload.title, body: payload.body },
    data: payload.data ?? {}
  })

  // Prune tokens FCM rejected as no longer valid.
  const dead: string[] = []
  res.responses.forEach((r, i) => {
    const code = r.error?.code
    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
      dead.push(tokens[i]!)
    }
  })
  if (dead.length) {
    await Promise.all(dead.map(t =>
      db.update(sessions).set({ fcmToken: null }).where(eq(sessions.fcmToken, t))
    ))
  }
}
