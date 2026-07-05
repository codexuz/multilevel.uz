<script setup lang="ts">
import type { OnlineUser, IncomingCall } from '~/composables/useSpeakingSocket'

const toast = useToast()
const socket = useSpeakingSocket()
const { connected, myPeerId, onlineUsers } = socket
const mesh = useMeshCall({ myPeerId, emit: socket.emit, on: socket.on })

const incoming = ref<IncomingCall | null>(null)
const inRoom = ref<string | null>(null)

onMounted(() => {
  socket.connect()

  socket.on('call-invite', (msg) => {
    incoming.value = { from: msg.from as string, fromName: msg.fromName as string, roomId: msg.roomId as string }
  })
  socket.on('call-accepted', (msg) => {
    // Callee accepted — both sides join the room.
    joinRoom(msg.roomId as string)
  })
  socket.on('call-rejected', () => {
    toast.add({ title: 'Call declined', color: 'warning' })
  })
  socket.on('room-joined', (msg) => {
    inRoom.value = msg.roomId as string
  })
})

async function callUser(u: OnlineUser) {
  await mesh.start()
  const roomId = crypto.randomUUID()
  socket.emit('call-invite', { userId: u.userId, roomId })
  toast.add({ title: `Calling ${u.name}…`, color: 'info' })
}

async function acceptCall() {
  if (!incoming.value) return
  const call = incoming.value
  incoming.value = null
  await mesh.start()
  socket.emit('call-accept', { from: call.from, roomId: call.roomId })
  joinRoom(call.roomId)
}

function rejectCall() {
  if (!incoming.value) return
  socket.emit('call-reject', { from: incoming.value.from })
  incoming.value = null
}

async function randomCall() {
  await mesh.start()
  socket.emit('random')
  toast.add({ title: 'Looking for a partner…', color: 'info' })
}

async function createRoom() {
  await mesh.start()
  const roomId = crypto.randomUUID()
  socket.emit('join', { roomId })
  const url = `${location.origin}/speaking/room/${roomId}`
  await navigator.clipboard?.writeText(url).catch(() => {})
  toast.add({ title: 'Room created — link copied', description: url, color: 'success' })
}

function joinRoom(roomId: string) {
  socket.emit('join', { roomId })
  inRoom.value = roomId
}

function leave() {
  socket.emit('leave')
  mesh.hangup()
  inRoom.value = null
}
</script>

<template>
  <UContainer class="py-8 max-w-3xl space-y-6">
    <div class="text-center space-y-2">
      <UIcon name="i-lucide-mic" class="size-10 text-primary mx-auto" />
      <h1 class="text-2xl font-bold">
        Live Speaking
      </h1>
      <p class="text-muted">
        Call another student directly, get randomly matched, or create a room and share the link.
      </p>
      <UBadge
        :color="connected ? 'success' : 'neutral'"
        variant="subtle"
        :label="connected ? 'Online' : 'Connecting…'"
        size="sm"
      />
    </div>

    <!-- Incoming call prompt -->
    <UAlert
      v-if="incoming"
      color="primary"
      variant="subtle"
      icon="i-lucide-phone-incoming"
      :title="`${incoming.fromName} is calling`"
    >
      <template #actions>
        <UButton color="success" label="Accept" icon="i-lucide-phone" @click="acceptCall" />
        <UButton color="error" variant="ghost" label="Decline" @click="rejectCall" />
      </template>
    </UAlert>

    <!-- Active call -->
    <UCard v-if="mesh.active.value">
      <div class="flex flex-col items-center gap-4 py-4">
        <div class="flex items-center gap-2 text-success">
          <span class="size-3 rounded-full bg-success animate-pulse" />
          <span class="font-semibold">
            In call · {{ mesh.peers.value.length }} connected
          </span>
        </div>
        <div class="flex flex-wrap justify-center gap-3">
          <div v-for="p in mesh.peers.value" :key="p.peerId" class="text-center">
            <UAvatar :alt="p.name" size="lg" />
            <p class="text-xs mt-1">
              {{ p.name }}
            </p>
            <RemoteAudio :stream="p.stream" />
          </div>
        </div>
        <div class="flex gap-2">
          <UButton
            :icon="mesh.muted.value ? 'i-lucide-mic-off' : 'i-lucide-mic'"
            :color="mesh.muted.value ? 'warning' : 'neutral'"
            variant="soft"
            :label="mesh.muted.value ? 'Unmute' : 'Mute'"
            @click="mesh.toggleMute"
          />
          <UButton icon="i-lucide-phone-off" color="error" label="Leave" @click="leave" />
        </div>
        <UAlert
          v-if="mesh.error.value"
          color="error"
          variant="subtle"
          :description="mesh.error.value"
        />
      </div>
    </UCard>

    <!-- Actions -->
    <div v-else class="grid gap-4 sm:grid-cols-2">
      <UButton size="lg" icon="i-lucide-shuffle" label="Random call" block @click="randomCall" />
      <UButton size="lg" icon="i-lucide-link" label="Create a room" color="neutral" variant="subtle" block @click="createRoom" />
    </div>

    <!-- Online users -->
    <section class="space-y-3">
      <h2 class="font-semibold">
        Online now
      </h2>
      <UCard v-if="onlineUsers.length" :ui="{ body: 'p-0 sm:p-0' }">
        <div class="divide-y divide-default">
          <div v-for="u in onlineUsers" :key="u.userId" class="flex items-center gap-3 p-4">
            <UAvatar :alt="u.name" size="sm" />
            <div class="flex-1 min-w-0">
              <p class="font-medium truncate">
                {{ u.name }}
              </p>
              <p class="text-xs text-muted capitalize">
                {{ u.status }}
              </p>
            </div>
            <UButton
              size="sm"
              icon="i-lucide-phone"
              label="Call"
              :disabled="u.status === 'busy' || mesh.active.value"
              @click="callUser(u)"
            />
          </div>
        </div>
      </UCard>
      <UAlert
        v-else
        icon="i-lucide-users"
        color="neutral"
        variant="subtle"
        title="Nobody online"
        description="Invite a friend or create a room and share the link."
      />
    </section>
  </UContainer>
</template>
