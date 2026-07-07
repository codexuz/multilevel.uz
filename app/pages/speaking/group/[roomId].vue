<script setup lang="ts">
const route = useRoute()
const toast = useToast()
const { me } = useMe()
const roomId = route.params.roomId as string

const socket = useSpeakingSocket()
const { connected, myPeerId } = socket
const mesh = useMeshCall({ myPeerId, emit: socket.emit, on: socket.on })
const callSounds = useCallSounds()

const joined = ref(false)
let offRoomEnded: (() => void) | undefined
let offPeerJoined: (() => void) | undefined

const roomUrl = computed(() => import.meta.client ? `${location.origin}/speaking/group/${roomId}` : '')
const attendees = computed(() => [
  {
    peerId: 'self',
    name: me.value?.name || me.value?.email || 'You',
    avatarUrl: me.value?.avatarUrl || undefined,
    current: true
  },
  ...mesh.peers.value.map(peer => ({
    peerId: peer.peerId,
    name: peer.name,
    avatarUrl: peer.avatarUrl || undefined,
    current: false,
    stream: peer.stream
  }))
])

onMounted(() => {
  socket.connect()

  offRoomEnded = socket.on('room-ended', () => {
    mesh.hangup()
    callSounds.stopLoops()
    callSounds.play('ended')
    joined.value = false
    toast.add({ title: 'Room ended', color: 'neutral' })
    navigateTo('/speaking/live')
  })

  offPeerJoined = socket.on('peer-joined', () => {
    callSounds.play('connected')
  })

  const stop = watch(connected, async (isConnected) => {
    if (isConnected && !joined.value) {
      await mesh.start()
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
  <UContainer class="min-h-[calc(100vh-4rem)] max-w-5xl pb-28 pt-8">
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="space-y-1">
        <div class="flex items-center gap-2 text-primary">
          <UIcon
            name="i-lucide-users"
            class="size-6"
          />
          <span class="text-sm font-medium">Speaking room</span>
        </div>
        <h1 class="text-2xl font-bold">
          Group speaking practice
        </h1>
        <p class="text-sm text-muted">
          Room {{ roomId.slice(0, 8) }}
        </p>
      </div>
      <UBadge
        :color="connected ? 'success' : 'neutral'"
        variant="subtle"
        :label="connected ? `${attendees.length} attending` : 'Connecting...'"
      />
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="attendee in attendees"
        :key="attendee.peerId"
        class="flex min-h-44 flex-col items-center justify-center rounded-lg border border-default bg-default p-5 text-center shadow-sm"
      >
        <UAvatar
          :src="attendee.avatarUrl"
          :alt="attendee.name"
          size="xl"
          class="size-20 text-xl"
        />
        <div class="mt-4 max-w-full">
          <p class="truncate font-semibold">
            {{ attendee.name }}
          </p>
          <p class="mt-1 text-xs text-muted">
            {{ attendee.current ? 'You' : 'Connected' }}
          </p>
        </div>
        <RemoteAudio
          v-if="'stream' in attendee && attendee.stream"
          :stream="attendee.stream"
        />
      </div>

      <div
        v-if="attendees.length === 1"
        class="flex min-h-44 flex-col items-center justify-center rounded-lg border border-dashed border-default p-5 text-center"
      >
        <UIcon
          name="i-lucide-user-plus"
          class="size-8 text-muted"
        />
        <p class="mt-3 font-medium">
          Waiting for others
        </p>
        <p class="mt-1 text-sm text-muted">
          Share the room link to invite partners.
        </p>
      </div>
    </div>

    <div class="fixed inset-x-0 bottom-0 z-30 border-t border-default bg-default/95 px-4 py-3 backdrop-blur">
      <div class="mx-auto flex max-w-5xl items-center justify-center gap-3">
        <UButton
          :icon="mesh.muted.value ? 'i-lucide-mic-off' : 'i-lucide-mic'"
          :color="mesh.muted.value ? 'warning' : 'neutral'"
          variant="soft"
          :label="mesh.muted.value ? 'Unmute' : 'Mute'"
          @click="mesh.toggleMute"
        />
        <UButton
          icon="i-lucide-share-2"
          color="neutral"
          variant="subtle"
          label="Share"
          @click="copyRoomLink"
        />
        <UButton
          icon="i-lucide-phone-off"
          color="error"
          label="End call"
          @click="leave"
        />
      </div>
    </div>
  </UContainer>
</template>
