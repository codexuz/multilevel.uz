<script setup lang="ts">
const route = useRoute()
const toast = useToast()
const roomId = route.params.roomId as string

const socket = useSpeakingSocket()
const { connected, myPeerId } = socket
const mesh = useMeshCall({ myPeerId, emit: socket.emit, on: socket.on })
const callSounds = useCallSounds()

const joined = ref(false)
const inviteAccepted = ref(false)
let offRoomEnded: (() => void) | undefined
let offPeerJoined: (() => void) | undefined
const inviteFrom = computed(() => {
  const from = route.query.from
  return Array.isArray(from) ? from[0] : from
})
const inviteName = computed(() => {
  const name = route.query.withName
  return Array.isArray(name) ? name[0] : name
})
const inviteAvatar = computed(() => {
  const avatar = route.query.withAvatar
  return Array.isArray(avatar) ? avatar[0] : avatar
})
const roomUrl = computed(() => import.meta.client ? `${location.origin}/speaking/room/${roomId}` : '')
const partner = computed(() => mesh.peers.value[0])
const partnerName = computed(() => partner.value?.name || inviteName.value || 'Connecting...')
const partnerAvatar = computed(() => partner.value?.avatarUrl || inviteAvatar.value || undefined)
const callActive = computed(() => joined.value || mesh.active.value)

onMounted(async () => {
  socket.connect()

  offRoomEnded = socket.on('room-ended', () => {
    mesh.hangup()
    callSounds.stopLoops()
    callSounds.play('ended')
    joined.value = false
    toast.add({ title: 'Speaking session ended', color: 'neutral' })
    navigateTo('/speaking/live')
  })

  offPeerJoined = socket.on('peer-joined', () => {
    callSounds.stopLoops()
    callSounds.play('connected')
  })

  // Wait for the socket to register before joining.
  const stop = watch(connected, async (isConnected) => {
    if (isConnected && !joined.value) {
      await mesh.start()
      if (inviteFrom.value && !inviteAccepted.value) {
        socket.emit('call-accept', { from: inviteFrom.value, roomId })
        inviteAccepted.value = true
      }
      socket.emit('join', { roomId })
      joined.value = true
      stop()
    }
  }, { immediate: true })
})

onBeforeUnmount(() => {
  offRoomEnded?.()
  offPeerJoined?.()
})

watch(() => mesh.peers.value.length, (count, previous) => {
  if (count > 0 && previous === 0) {
    callSounds.stopLoops()
    callSounds.play('connected')
  }
})

async function copyRoomLink() {
  if (!roomUrl.value) return
  await navigator.clipboard?.writeText(roomUrl.value).catch(() => {})
  toast.add({
    title: 'Room link copied',
    description: roomUrl.value,
    color: 'success'
  })
}

function leave() {
  socket.emit('leave')
  mesh.hangup()
  callSounds.stopLoops()
  callSounds.play('ended')
  navigateTo('/speaking/live')
}
</script>

<template>
  <UContainer class="py-8 max-w-2xl space-y-6">
    <div class="text-center space-y-2">
      <UIcon name="i-lucide-users" class="size-10 text-primary mx-auto" />
      <h1 class="text-2xl font-bold">
        Speaking Room
      </h1>
      <p class="text-muted text-sm">
        Room {{ roomId.slice(0, 8) }}
      </p>
      <UBadge
        :color="connected ? 'success' : 'neutral'"
        variant="subtle"
        :label="connected ? 'Connected' : 'Connecting…'"
        size="sm"
      />
    </div>

    <Teleport to="body">
      <div
        v-if="callActive"
        class="fixed inset-0 z-40 flex items-center justify-center bg-default/80 p-4 backdrop-blur"
        role="dialog"
        aria-modal="true"
      >
        <div class="w-full max-w-sm rounded-lg border border-default bg-default p-6 shadow-xl">
          <div class="flex flex-col items-center text-center">
            <div class="relative">
              <UAvatar
                :src="partnerAvatar"
                :alt="partnerName"
                size="xl"
                class="size-24 text-2xl"
              />
              <span class="absolute bottom-1 right-1 size-4 rounded-full border-2 border-default bg-success" />
            </div>
            <p class="mt-4 text-xs font-medium uppercase text-muted">
              Speaking call
            </p>
            <h2 class="mt-1 max-w-full truncate text-xl font-semibold">
              {{ partnerName }}
            </h2>
            <p class="mt-2 text-sm text-muted">
              {{ mesh.peers.value.length ? 'Connected' : 'Waiting for them to join...' }}
            </p>
          </div>

          <div class="mt-6 flex items-center justify-center gap-3">
            <UButton
              icon="i-lucide-copy"
              color="neutral"
              variant="subtle"
              label="Copy link"
              @click="copyRoomLink"
            />
            <UButton
              :icon="mesh.muted.value ? 'i-lucide-mic-off' : 'i-lucide-mic'"
              :color="mesh.muted.value ? 'warning' : 'neutral'"
              variant="soft"
              :label="mesh.muted.value ? 'Unmute' : 'Mute'"
              @click="mesh.toggleMute"
            />
            <UButton
              icon="i-lucide-phone-off"
              color="error"
              label="End call"
              @click="leave"
            />
          </div>

          <UAlert
            v-if="mesh.error.value"
            class="mt-5"
            color="error"
            variant="subtle"
            :description="mesh.error.value"
          />
        </div>
      </div>
    </Teleport>

    <RemoteAudio
      v-for="p in mesh.peers.value"
      :key="p.peerId"
      :stream="p.stream"
    />
  </UContainer>
</template>
