<script setup lang="ts">
import type { IncomingCall } from '~/composables/useSpeakingSocket'

const route = useRoute()
const toast = useToast()
const { loggedIn } = useMe()
const socket = useSpeakingSocket()
const callSounds = useCallSounds()

const incoming = useState<IncomingCall | null>('speaking-incoming-call', () => null)
const recentEvents = useState<Record<string, number>>('speaking-call-event-dedupe', () => ({}))
const accepting = ref(false)
const cleanups: Array<() => void> = []
let stopLoggedIn: (() => void) | undefined

const visible = computed(() => !!incoming.value && !route.path.startsWith('/speaking/room/'))
const callLabel = computed(() => incoming.value?.random ? 'Random speaking call' : 'Incoming speaking call')

function shouldHandle(key: string, ttl = 2000) {
  const now = Date.now()
  const previous = recentEvents.value[key] ?? 0
  if (now - previous < ttl) return false
  recentEvents.value = { ...recentEvents.value, [key]: now }
  return true
}

onMounted(() => {
  stopLoggedIn = watch(loggedIn, (isLoggedIn) => {
    if (isLoggedIn) socket.connect()
    else {
      incoming.value = null
      socket.disconnect()
    }
  }, { immediate: true })

  cleanups.push(socket.on('call-invite', (msg) => {
    incoming.value = {
      from: msg.from as string,
      fromName: msg.fromName as string,
      fromAvatarUrl: msg.fromAvatarUrl as string | null | undefined,
      roomId: msg.roomId as string,
      random: Boolean(msg.random)
    }
    callSounds.stopLoops()
    callSounds.play('incoming')
  }))

  cleanups.push(socket.on('call-accepted', (msg) => {
    const roomId = msg.roomId as string
    if (!roomId) return
    if (!shouldHandle(`call-accepted:${roomId}`)) return
    callSounds.stopLoops()
    callSounds.play('connected')
    toast.add({ title: 'Call accepted', color: 'success' })
    navigateTo({
      path: `/speaking/room/${roomId}`,
      query: {
        withName: msg.byName as string | undefined,
        withAvatar: (msg.byAvatarUrl as string | null | undefined) || undefined
      }
    })
  }))

  cleanups.push(socket.on('call-rejected', (msg) => {
    if (!shouldHandle(`call-rejected:${String(msg.by ?? '')}`)) return
    callSounds.stopLoops()
    callSounds.play('failed')
    toast.add({ title: 'Call declined', color: 'warning' })
  }))

  cleanups.push(socket.on('call-ringing', (msg) => {
    if (!shouldHandle(`call-ringing:${String(msg.roomId ?? msg.userId ?? '')}`)) return
    callSounds.stopLoops()
    callSounds.play('outgoing')
    toast.add({
      title: msg.random ? 'Random call sent' : 'Calling...',
      description: msg.random ? 'Waiting for a speaking partner to answer.' : undefined,
      color: 'info'
    })
  }))

  cleanups.push(socket.on('random-waiting', () => {
    if (!shouldHandle('random-waiting')) return
    callSounds.stopLoops()
    callSounds.play('noConnection')
    toast.add({
      title: 'No partner online',
      description: 'Try again when another student is available.',
      color: 'warning'
    })
  }))
})

onBeforeUnmount(() => {
  callSounds.stopLoops()
  stopLoggedIn?.()
  cleanups.forEach(fn => fn())
  cleanups.length = 0
})

async function acceptCall() {
  if (!incoming.value || accepting.value) return
  accepting.value = true
  const call = incoming.value
  incoming.value = null
  callSounds.stop('incoming')
  callSounds.play('connecting')
  socket.emit('call-accept', { from: call.from, roomId: call.roomId })
  await navigateTo({
    path: `/speaking/room/${call.roomId}`,
    query: {
      withName: call.fromName,
      withAvatar: call.fromAvatarUrl || undefined
    }
  })
  accepting.value = false
}

function rejectCall() {
  if (!incoming.value) return
  socket.emit('call-reject', { from: incoming.value.from })
  incoming.value = null
  callSounds.stop('incoming')
  callSounds.play('ended')
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
