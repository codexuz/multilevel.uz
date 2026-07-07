interface SocketApi {
  myPeerId: Ref<string | null>
  emit: (type: string, payload?: Record<string, unknown>) => void
  on: (type: string, fn: (msg: Record<string, unknown>) => void) => () => void
}

export interface RemotePeer {
  peerId: string
  name: string
  avatarUrl?: string | null
  stream: MediaStream
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
]

/**
 * Full-mesh WebRTC audio. One RTCPeerConnection per remote peer, signaled over the
 * speaking socket's `signal` relay. Generalizes the old 1:1 useWebRTC to rooms.
 */
export function useMeshCall(socket: SocketApi) {
  const peers = ref<RemotePeer[]>([])
  const muted = ref(false)
  const error = ref<string | null>(null)
  const active = ref(false)

  let localStream: MediaStream | null = null
  const connections = new Map<string, RTCPeerConnection>()
  const cleanups: Array<() => void> = []

  async function ensureLocal() {
    if (localStream) return localStream
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    return localStream
  }

  function upsertPeer(peerId: string, name: string, stream: MediaStream, avatarUrl?: string | null) {
    const existing = peers.value.find(p => p.peerId === peerId)
    if (existing) {
      existing.name = name
      existing.avatarUrl = avatarUrl
      existing.stream = stream
    } else {
      peers.value.push({ peerId, name, avatarUrl, stream })
    }
  }

  function removePeer(peerId: string) {
    connections.get(peerId)?.close()
    connections.delete(peerId)
    peers.value = peers.value.filter(p => p.peerId !== peerId)
  }

  function createConnection(peerId: string, name: string, avatarUrl?: string | null) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    connections.set(peerId, pc)

    localStream?.getTracks().forEach(t => pc.addTrack(t, localStream!))

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        socket.emit('signal', { to: peerId, signal: { kind: 'ice', candidate: ev.candidate } })
      }
    }
    pc.ontrack = (ev) => {
      upsertPeer(peerId, name, ev.streams[0]!, avatarUrl)
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') removePeer(peerId)
    }
    return pc
  }

  // Initiate an offer to a peer that was already in the room when we joined.
  async function callPeer(peerId: string, name: string, avatarUrl?: string | null) {
    await ensureLocal()
    const pc = createConnection(peerId, name, avatarUrl)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    socket.emit('signal', { to: peerId, signal: { kind: 'offer', sdp: offer } })
  }

  async function handleSignal(msg: Record<string, unknown>) {
    const from = msg.from as string
    const signal = msg.signal as Record<string, unknown>
    const kind = signal.kind as string
    let pc = connections.get(from)
    const name = (msg.fromName as string | undefined) || (signal.name as string | undefined) || 'Peer'
    const avatarUrl = (msg.fromAvatarUrl as string | null | undefined) || null

    if (kind === 'offer') {
      await ensureLocal()
      pc = pc ?? createConnection(from, name, avatarUrl)
      await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp as RTCSessionDescriptionInit))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      socket.emit('signal', { to: from, signal: { kind: 'answer', sdp: answer } })
    } else if (kind === 'answer' && pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp as RTCSessionDescriptionInit))
    } else if (kind === 'ice' && pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate as RTCIceCandidateInit))
      } catch { /* ignore late candidates */ }
    }
  }

  // Wire up socket events for the mesh.
  function bind() {
    cleanups.push(socket.on('signal', (msg) => {
      handleSignal(msg)
    }))
    // We joined a room: offer to everyone already there.
    cleanups.push(socket.on('room-joined', async (msg) => {
      active.value = true
      await ensureLocal()
      const existing = (msg.peers as { peerId: string, name: string, avatarUrl?: string | null }[]) ?? []
      for (const p of existing) await callPeer(p.peerId, p.name, p.avatarUrl)
    }))
    // A new peer joined after us: they will send the offer, just note their name.
    cleanups.push(socket.on('peer-joined', () => {
      active.value = true
    }))
    cleanups.push(socket.on('peer-left', msg => removePeer(msg.peerId as string)))
    cleanups.push(socket.on('room-ended', () => hangup()))
  }

  async function start() {
    try {
      await ensureLocal()
      bind()
      active.value = true
    } catch (e) {
      error.value = (e as Error).message || 'Microphone access denied'
    }
  }

  function toggleMute() {
    muted.value = !muted.value
    localStream?.getAudioTracks().forEach(t => (t.enabled = !muted.value))
  }

  function hangup() {
    for (const pid of [...connections.keys()]) removePeer(pid)
    localStream?.getTracks().forEach(t => t.stop())
    localStream = null
    peers.value = []
    active.value = false
    cleanups.forEach(fn => fn())
    cleanups.length = 0
  }

  onBeforeUnmount(hangup)

  return { peers, muted, error, active, start, callPeer, toggleMute, hangup }
}
