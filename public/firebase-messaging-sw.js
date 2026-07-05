/* global importScripts, firebase */
// Background push handler. Pulls the public Firebase config from a runtime endpoint
// so no build-time secrets are baked into this static file.
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js')

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification?.data?.url || '/'
  event.waitUntil(clients.openWindow(url))
})

async function init() {
  try {
    const res = await fetch('/api/fcm-config')
    const cfg = await res.json()
    if (!cfg.apiKey) return
    firebase.initializeApp(cfg)
    const messaging = firebase.messaging()
    messaging.onBackgroundMessage((payload) => {
      const n = payload.notification || {}
      self.registration.showNotification(n.title || 'Multilevel', {
        body: n.body,
        icon: '/favicon.ico',
        data: payload.data || {}
      })
    })
  } catch (e) {
    // no-op if config isn't available
  }
}
init()
