import type { Peer } from 'crossws'
import { sendPush } from '../../utils/firebase'

// ---- In-memory presence & room registry (single-instance) ----
interface Presence {
  userId: string
  name: string
  peer: Peer
  status: 'available' | 'busy'
  roomId: string | null
}

const online = new Map<string, Presence>() // peerId -> presence
const byUser = new Map<string, string>() // userId -> peerId
const rooms = new Map<string, Set<string>>() // roomId -> set of peerIds

function peerId(peer: Peer): string {
  return peer.id
}

function send(peer: Peer, type: string, payload: Record<string, unknown> = {}) {
  peer.send(JSON.stringify({ type, ...payload }))
}

function onlineList() {
  return [...online.values()].map(p => ({
    userId: p.userId,
    peerId: byUser.get(p.userId),
    name: p.name,
    status: p.status
  }))
}

function broadcastPresence() {
  const list = onlineList()
  for (const p of online.values()) {
    send(p.peer, 'presence', { users: list.filter(u => u.userId !== p.userId) })
  }
}

function findPeerByUser(userId: string): Presence | undefined {
  const pid = byUser.get(userId)
  return pid ? online.get(pid) : undefined
}

function joinRoom(pres: Presence, roomId: string) {
  const set = rooms.get(roomId) ?? new Set<string>()
  // Tell the joiner about existing peers so it can initiate offers.
  const existing = [...set].map(pid => online.get(pid)).filter(Boolean) as Presence[]
  set.add(peerId(pres.peer))
  rooms.set(roomId, set)
  pres.roomId = roomId
  pres.status = 'busy'
  send(pres.peer, 'room-joined', {
    roomId,
    peers: existing.map(e => ({ peerId: peerId(e.peer), name: e.name }))
  })
  // Notify existing peers a new peer arrived (they wait for the newcomer's offer).
  for (const e of existing) {
    send(e.peer, 'peer-joined', { peerId: peerId(pres.peer), name: pres.name })
  }
}

function leaveRoom(pres: Presence) {
  const roomId = pres.roomId
  if (!roomId) return
  const set = rooms.get(roomId)
  if (set) {
    set.delete(peerId(pres.peer))
    for (const pid of set) {
      const other = online.get(pid)
      if (other) send(other.peer, 'peer-left', { peerId: peerId(pres.peer) })
    }
    if (set.size === 0) rooms.delete(roomId)
  }
  pres.roomId = null
  pres.status = 'available'
}

export default defineWebSocketHandler({
  open() {
    // Wait for `hello` before registering (carries identity).
  },

  async message(peer, message) {
    let msg: { type: string, [k: string]: unknown }
    try {
      msg = JSON.parse(message.text())
    } catch {
      return
    }

    const self = online.get(peerId(peer))

    switch (msg.type) {
      case 'hello': {
        const userId = String(msg.userId ?? '')
        const name = String(msg.name ?? 'Student')
        if (!userId) return
        // Replace any stale peer for this user.
        const prev = byUser.get(userId)
        if (prev && prev !== peerId(peer)) online.delete(prev)
        online.set(peerId(peer), { userId, name, peer, status: 'available', roomId: null })
        byUser.set(userId, peerId(peer))
        send(peer, 'hello-ok', { peerId: peerId(peer) })
        broadcastPresence()
        break
      }

      case 'call-invite': {
        if (!self) return
        const targetUserId = String(msg.userId ?? '')
        const target = findPeerByUser(targetUserId)
        const roomId = String(msg.roomId ?? crypto.randomUUID())
        if (target && target.status === 'available') {
          send(target.peer, 'call-invite', { from: self.userId, fromName: self.name, roomId })
        }
        // Also push in case their tab is backgrounded / offline.
        await sendPush([targetUserId], {
          title: `${self.name} is calling`,
          body: 'Tap to join the speaking call.',
          data: { url: `/speaking/room/${roomId}?from=${encodeURIComponent(self.userId)}` }
        })
        send(peer, 'call-ringing', { userId: targetUserId, roomId })
        break
      }

      case 'call-accept': {
        if (!self) return
        const roomId = String(msg.roomId ?? '')
        const fromUserId = String(msg.from ?? '')
        const caller = findPeerByUser(fromUserId)
        if (caller) send(caller.peer, 'call-accepted', { by: self.userId, roomId })
        break
      }

      case 'call-reject': {
        if (!self) return
        const fromUserId = String(msg.from ?? '')
        const caller = findPeerByUser(fromUserId)
        if (caller) send(caller.peer, 'call-rejected', { by: self.userId })
        break
      }

      case 'random': {
        if (!self) return
        // Invite any other available, room-less user and let them accept.
        const other = [...online.values()].find(p =>
          p.userId !== self.userId && p.status === 'available' && !p.roomId
        )
        if (other) {
          const roomId = crypto.randomUUID()
          send(other.peer, 'call-invite', {
            from: self.userId,
            fromName: self.name,
            roomId,
            random: true
          })
          await sendPush([other.userId], {
            title: 'Random speaking call',
            body: `${self.name} is looking for a speaking partner.`,
            data: { url: `/speaking/room/${roomId}?from=${encodeURIComponent(self.userId)}` }
          })
          send(peer, 'call-ringing', { userId: other.userId, roomId, random: true })
        } else {
          send(peer, 'random-waiting')
        }
        break
      }

      case 'join': {
        if (!self) return
        leaveRoom(self)
        joinRoom(self, String(msg.roomId ?? crypto.randomUUID()))
        broadcastPresence()
        break
      }

      case 'leave': {
        if (!self) return
        leaveRoom(self)
        broadcastPresence()
        break
      }

      case 'signal': {
        // Relay offer/answer/ice to a specific peer.
        const toPeerId = String(msg.to ?? '')
        const target = online.get(toPeerId)
        if (target && self) {
          send(target.peer, 'signal', {
            from: peerId(peer),
            signal: msg.signal
          })
        }
        break
      }
    }
  },

  close(peer) {
    const self = online.get(peerId(peer))
    if (self) {
      leaveRoom(self)
      online.delete(peerId(peer))
      if (byUser.get(self.userId) === peerId(peer)) byUser.delete(self.userId)
      broadcastPresence()
    }
  }
})
