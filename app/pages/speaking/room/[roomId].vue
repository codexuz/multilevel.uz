<script setup lang="ts">
const route = useRoute()
const roomId = route.params.roomId as string

const socket = useSpeakingSocket()
const { connected, myPeerId } = socket
const mesh = useMeshCall({ myPeerId, emit: socket.emit, on: socket.on })

const joined = ref(false)

onMounted(async () => {
  socket.connect()
  // Wait for the socket to register before joining.
  const stop = watch(connected, async (isConnected) => {
    if (isConnected && !joined.value) {
      await mesh.start()
      socket.emit('join', { roomId })
      joined.value = true
      stop()
    }
  }, { immediate: true })
})

function leave() {
  socket.emit('leave')
  mesh.hangup()
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

    <UCard>
      <div class="flex flex-col items-center gap-4 py-6">
        <div class="flex flex-wrap justify-center gap-4">
          <div class="text-center">
            <UAvatar alt="You" size="lg" icon="i-lucide-user" />
            <p class="text-xs mt-1">
              You
            </p>
          </div>
          <div v-for="p in mesh.peers.value" :key="p.peerId" class="text-center">
            <UAvatar :alt="p.name" size="lg" />
            <p class="text-xs mt-1">
              {{ p.name }}
            </p>
            <RemoteAudio :stream="p.stream" />
          </div>
        </div>

        <p v-if="!mesh.peers.value.length" class="text-muted text-sm">
          Waiting for others to join…
        </p>

        <div class="flex gap-2">
          <UButton
            :icon="mesh.muted.value ? 'i-lucide-mic-off' : 'i-lucide-mic'"
            :color="mesh.muted.value ? 'warning' : 'neutral'"
            variant="soft"
            :label="mesh.muted.value ? 'Unmute' : 'Mute'"
            @click="mesh.toggleMute"
          />
          <UButton icon="i-lucide-phone-off" color="error" label="Leave room" @click="leave" />
        </div>

        <UAlert
          v-if="mesh.error.value"
          color="error"
          variant="subtle"
          :description="mesh.error.value"
        />
      </div>
    </UCard>
  </UContainer>
</template>
