// Subscribes to the per-user SSE stream while logged in and reacts to events
// (e.g. premium granted/revoked) by refreshing /api/me so the UI updates live.
export default defineNuxtPlugin(() => {
  const { loggedIn, refresh } = useMe()
  const toast = useToast()
  let es: EventSource | null = null

  function connect() {
    if (es) return
    es = new EventSource('/api/me/events')
    es.onmessage = (e) => {
      let msg: { type?: string, isPremium?: boolean }
      try {
        msg = JSON.parse(e.data)
      } catch {
        return
      }
      if (msg.type === 'premium') {
        refresh()
        if (msg.isPremium) {
          toast.add({
            title: 'Premium activated 🎉',
            description: 'Your account now has premium access.',
            color: 'primary',
            icon: 'i-lucide-sparkles'
          })
        }
      }
    }
    // EventSource auto-reconnects on transient errors; the loggedIn watcher
    // tears it down on logout.
  }

  function disconnect() {
    es?.close()
    es = null
  }

  watch(loggedIn, connected => (connected ? connect() : disconnect()), { immediate: true })
})
