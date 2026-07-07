export interface OnlineUser {
  userId: string
  peerId: string
  name: string
  avatarUrl?: string | null
  status: 'available' | 'busy'
}

export interface IncomingCall {
  from: string
  fromName: string
  fromAvatarUrl?: string | null
  roomId: string
  random?: boolean
}

type Handler = (msg: Record<string, unknown>) => void

let ws: WebSocket | null = null
let currentUserId: string | null = null
const handlers = new Map<string, Set<Handler>>()

/**
 * Thin wrapper over the Nitro WebSocket signaling server (`/ws/speaking`).
 * Registers presence on connect and dispatches typed messages to listeners.
 */
export function useSpeakingSocket() {
  const { me } = useMe()

  const connected = useState('speaking-socket-connected', () => false)
  const myPeerId = useState<string | null>('speaking-socket-peer-id', () => null)
  const onlineUsers = useState<OnlineUser[]>('speaking-socket-online-users', () => [])

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
    if (!me.value?.id) return

    currentUserId = me.value.id
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    ws = new WebSocket(`${proto}://${location.host}/ws/speaking`)

    ws.onopen = () => {
      connected.value = true
      emit('hello', {
        userId: currentUserId,
        name: me.value?.name || me.value?.email || 'Student',
        avatarUrl: me.value?.avatarUrl
      })
    }
    ws.onclose = () => {
      connected.value = false
      myPeerId.value = null
      onlineUsers.value = []
      ws = null
      currentUserId = null
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
    myPeerId.value = null
    onlineUsers.value = []
    currentUserId = null
  }

  return { connected, myPeerId, onlineUsers, connect, disconnect, on, emit }
}
