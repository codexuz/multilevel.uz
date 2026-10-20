// Subscribes to the per-user SSE stream while logged in and reacts to events: a Writing or
// Speaking attempt marked by an examiner, or the account being banned.
export default defineNuxtPlugin((nuxtApp) => {
  const { loggedIn } = useMe()
  const toast = useToast()
  let es: EventSource | null = null

  function connect() {
    if (es) return
    es = new EventSource('/api/me/events')
    es.onmessage = (e) => {
      let msg: { type?: string, attemptId?: string }
      try {
        msg = JSON.parse(e.data)
      } catch {
        return
      }
      if (msg.type === 'graded' && msg.attemptId) {
        nuxtApp.callHook('ml:graded' as any, msg.attemptId)
        toast.add({
          title: 'Your test has been marked',
          description: 'An examiner has marked your answers.',
          color: 'success',
          icon: 'i-lucide-award',
          actions: [{ label: 'See result', to: `/results/${msg.attemptId}` }]
        })
      } else if (msg.type === 'banned') {
        toast.add({
          title: 'Account suspended',
          description: 'Your account has been banned. Contact support if you think this is a mistake.',
          color: 'error',
          icon: 'i-lucide-ban'
        })
        disconnect()
        navigateTo('/login')
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
