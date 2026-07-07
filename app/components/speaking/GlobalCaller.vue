<script setup lang="ts">
import type { IncomingCall } from '~/composables/useSpeakingSocket'

const route = useRoute()
const toast = useToast()
const { loggedIn } = useMe()
const socket = useSpeakingSocket()

const incoming = useState<IncomingCall | null>('speaking-incoming-call', () => null)
const accepting = ref(false)

const visible = computed(() => !!incoming.value && !route.path.startsWith('/speaking/room/'))
const callLabel = computed(() => incoming.value?.random ? 'Random speaking call' : 'Incoming speaking call')

onMounted(() => {
  watch(loggedIn, (isLoggedIn) => {
    if (isLoggedIn) socket.connect()
    else {
      incoming.value = null
      socket.disconnect()
    }
  }, { immediate: true })

  socket.on('call-invite', (msg) => {
    incoming.value = {
      from: msg.from as string,
      fromName: msg.fromName as string,
      roomId: msg.roomId as string,
      random: Boolean(msg.random)
    }
  })

  socket.on('call-accepted', (msg) => {
    const roomId = msg.roomId as string
    if (!roomId) return
    toast.add({ title: 'Call accepted', color: 'success' })
    navigateTo(`/speaking/room/${roomId}`)
  })

  socket.on('call-rejected', () => {
    toast.add({ title: 'Call declined', color: 'warning' })
  })

  socket.on('call-ringing', (msg) => {
    toast.add({
      title: msg.random ? 'Random call sent' : 'Calling...',
      description: msg.random ? 'Waiting for a speaking partner to answer.' : undefined,
      color: 'info'
    })
  })

  socket.on('random-waiting', () => {
    toast.add({
      title: 'No partner online',
      description: 'Try again when another student is available.',
      color: 'warning'
    })
  })
})

async function acceptCall() {
  if (!incoming.value || accepting.value) return
  accepting.value = true
  const call = incoming.value
  incoming.value = null
  socket.emit('call-accept', { from: call.from, roomId: call.roomId })
  await navigateTo(`/speaking/room/${call.roomId}`)
  accepting.value = false
}

function rejectCall() {
  if (!incoming.value) return
  socket.emit('call-reject', { from: incoming.value.from })
  incoming.value = null
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-3 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-3 opacity-0"
    >
      <div
        v-if="visible && incoming"
        class="fixed bottom-4 right-4 z-50 w-[min(24rem,calc(100vw-2rem))]"
      >
        <UAlert
          color="primary"
          variant="solid"
          icon="i-lucide-phone-incoming"
          :title="callLabel"
          :description="`${incoming.fromName} wants to practise speaking with you.`"
        >
          <template #actions>
            <UButton
              color="success"
              label="Accept"
              icon="i-lucide-phone"
              :loading="accepting"
              @click="acceptCall"
            />
            <UButton
              color="neutral"
              variant="ghost"
              label="Decline"
              @click="rejectCall"
            />
          </template>
        </UAlert>
      </div>
    </Transition>
  </Teleport>
</template>
