import type { FirebaseApp } from 'firebase/app'

let appPromise: Promise<FirebaseApp | null> | null = null

async function getApp(): Promise<FirebaseApp | null> {
  const cfg = useRuntimeConfig().public.firebase as Record<string, string>
  if (!cfg?.apiKey || !cfg?.projectId) return null
  const { initializeApp, getApps } = await import('firebase/app')
  return getApps()[0] ?? initializeApp({
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    messagingSenderId: cfg.messagingSenderId,
    appId: cfg.appId
  })
}

/** Client-side Firebase Cloud Messaging helper. */
export function useFcm() {
  const toast = useToast()

  async function enable() {
    if (!import.meta.client || !('Notification' in window)) return
    try {
      const { getMessaging, getToken, isSupported, onMessage } = await import('firebase/messaging')
      if (!(await isSupported())) return

      appPromise ??= getApp()
      const app = await appPromise
      if (!app) return

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return

      const cfg = useRuntimeConfig().public.firebase as Record<string, string>
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
      const messaging = getMessaging(app)
      const token = await getToken(messaging, {
        vapidKey: cfg.vapidKey,
        serviceWorkerRegistration: registration
      })
      if (token) {
        await $fetch('/api/me/fcm-token', { method: 'POST', body: { token } })
      }

      // Foreground messages → toast.
      onMessage(messaging, (payload) => {
        const n = payload.notification
        if (n?.title) {
          toast.add({
            title: n.title,
            description: n.body,
            icon: 'i-lucide-bell',
            actions: payload.data?.url
              ? [{ label: 'View', onClick: () => navigateTo(payload.data!.url as string) }]
              : undefined
          })
        }
      })
    } catch {
      // FCM is best-effort; ignore failures (unsupported browser, blocked, etc.)
    }
  }

  return { enable }
}
