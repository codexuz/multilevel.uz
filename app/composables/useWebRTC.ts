type SignalKind = 'ready' | 'offer' | 'answer' | 'ice' | 'bye'
interface Signal { kind: SignalKind, data?: unknown, from: string }

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
]

/**
 * Peer-to-peer audio call over WebRTC, using a Supabase Realtime broadcast channel
 * for signaling. One peer is the initiator (the room creator / "caller").
 */
export function useWebRTC() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  const connected = ref(false)
  const connecting = ref(false)
  const muted = ref(false)
  const error = ref<string | null>(null)
  const remoteAudio = ref<HTMLAudioElement | null>(null)

  let pc: RTCPeerConnection | null = null
  let channel: ReturnType<typeof supabase.channel> | null = null
  let localStream: MediaStream | null = null
  let selfId = ''

  function send(kind: SignalKind, data?: unknown) {
    channel?.send({ type: 'broadcast', event: 'signal', payload: { kind, data, from: selfId } satisfies Signal })
  }

  async function start(roomId: string, isInitiator: boolean) {
    connecting.value = true
    error.value = null
    selfId = user.value?.id || crypto.randomUUID()

    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      error.value = (e as Error).message || 'Microphone access denied'
      connecting.value = false
      return
    }

    pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    localStream.getTracks().forEach(t => pc!.addTrack(t, localStream!))

    pc.ontrack = (e) => {
      const [stream] = e.streams
      if (remoteAudio.value && stream) {
        remoteAudio.value.srcObject = stream
        remoteAudio.value.play().catch(() => {})
      }
    }
    pc.onicecandidate = (e) => {
      if (e.candidate) send('ice', e.candidate.toJSON())
    }
    pc.onconnectionstatechange = () => {
      if (!pc) return
      connected.value = pc.connectionState === 'connected'
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) connected.value = false
    }

    channel = supabase.channel(`webrtc-${roomId}`, { config: { broadcast: { self: false } } })
    channel.on('broadcast', { event: 'signal' }, (msg: { payload: Signal }) => handleSignal(msg.payload, isInitiator))
    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        // Announce readiness; the initiator makes the offer once the peer is ready.
        send('ready')
      }
    })
    connecting.value = false
  }

  async function handleSignal(sig: Signal, isInitiator: boolean) {
    if (!pc || sig.from === selfId) return
    try {
      switch (sig.kind) {
        case 'ready':
          if (isInitiator) {
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            send('offer', offer)
          }
          break
        case 'offer':
          await pc.setRemoteDescription(new RTCSessionDescription(sig.data as RTCSessionDescriptionInit))
          {
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            send('answer', answer)
          }
          break
        case 'answer':
          await pc.setRemoteDescription(new RTCSessionDescription(sig.data as RTCSessionDescriptionInit))
          break
        case 'ice':
          await pc.addIceCandidate(new RTCIceCandidate(sig.data as RTCIceCandidateInit))
          break
        case 'bye':
          hangup()
          break
      }
    } catch (e) {
      error.value = (e as Error).message
    }
  }

  function toggleMute() {
    muted.value = !muted.value
    localStream?.getAudioTracks().forEach(t => (t.enabled = !muted.value))
  }

  function hangup() {
    send('bye')
    localStream?.getTracks().forEach(t => t.stop())
    pc?.close()
    pc = null
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
    connected.value = false
    connecting.value = false
  }

  onBeforeUnmount(hangup)

  return { connected, connecting, muted, error, remoteAudio, start, toggleMute, hangup }
}
