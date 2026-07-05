export interface OnlineUser {
  userId: string
  peerId: string
  name: string
  status: 'available' | 'busy'
}

export interface IncomingCall {
  from: string
  fromName: string
  roomId: string
}

type Handler = (msg: Record<string, unknown>) => void

/**
 * Thin wrapper over the Nitro WebSocket signaling server (`/ws/speaking`).
 * Registers presence on connect and dispatches typed messages to listeners.
 */
export function useSpeakingSocket() {
  const { me } = useMe()

  const connected = ref(false)
  const myPeerId = ref<string | null>(null)
  const onlineUsers = ref<OnlineUser[]>([])

  let ws: WebSocket | null = null
  const handlers = new Map<string, Set<Handler>>()

  function on(type: string, fn: Handler) {
    const set = handlers.get(type) ?? new Set()
    set.add(fn)
    handlers.set(type, set)
    return () => set.delete(fn)
  }

  function emit(type: string, payload: Record<string, unknown> = {}) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, ...payload }))
    }
  }

  function connect() {
    if (!import.meta.client || ws) return
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    ws = new WebSocket(`${proto}://${location.host}/ws/speaking`)

    ws.onopen = () => {
      connected.value = true
      emit('hello', { userId: me.value?.id, name: me.value?.name || me.value?.email || 'Student' })
    }
    ws.onclose = () => {
      connected.value = false
      ws = null
    }
    ws.onmessage = (ev) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(ev.data)
      } catch {
        return
      }
      const type = msg.type as string
      if (type === 'hello-ok') myPeerId.value = msg.peerId as string
      if (type === 'presence') onlineUsers.value = (msg.users as OnlineUser[]) ?? []
      handlers.get(type)?.forEach(fn => fn(msg))
    }
  }

  function disconnect() {
    ws?.close()
    ws = null
    connected.value = false
  }

  onBeforeUnmount(disconnect)

  return { connected, myPeerId, onlineUsers, connect, disconnect, on, emit }
}
