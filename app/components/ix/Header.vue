<script setup lang="ts">
/**
 * The top bar of the test as the computer-delivered IELTS has it: the logo (Mockmee's: this is
 * practice, not the official test), who is sitting the test (and, under it, "Audio is Playing"
 * while the recording plays), the time left in the middle, and on the right the connection,
 * messages, Options and Notes.
 */
const props = withDefaults(defineProps<{
  initialSeconds: number
  running: boolean
  started: boolean
  leaveTo?: string
  /** A line under the candidate's name, e.g. "Audio is Playing". */
  status?: string
  statusIcon?: string
}>(), {})

const emit = defineEmits<{ timeUp: [] }>()

const chrome = useIxChrome()!
watchEffect(() => (chrome.leaveTo.value = props.leaveTo))

const { me } = useMe()
const candidate = computed(() => me.value?.name || accountHandle(me.value) || '')

// Whether the answers have reached the server, when the page sitting the attempt keeps them.
const saveState = inject(SAVE_STATE, null)
const connection = computed(() => {
  switch (saveState?.value) {
    case 'offline': return { label: 'Not connected — your answers are kept on this computer', off: true }
    case 'pending':
    case 'saving': return { label: 'Connected — saving', off: false }
    default: return { label: 'Connected', off: false }
  }
})

const seconds = ref(props.initialSeconds)
watch(() => props.initialSeconds, v => (seconds.value = v))

let timer: ReturnType<typeof setInterval> | undefined
watch(() => props.running, (running) => {
  clearInterval(timer)
  if (!running) return
  timer = setInterval(() => {
    if (seconds.value <= 1) {
      seconds.value = 0
      clearInterval(timer)
      emit('timeUp')
      return
    }
    seconds.value--
  }, 1000)
}, { immediate: true })
onBeforeUnmount(() => clearInterval(timer))

/** "39 minutes left", then the seconds in the last minute. */
const timeLeft = computed(() => {
  const s = seconds.value
  if (s >= 120) return `${Math.floor(s / 60)} minutes left`
  if (s >= 60) return '1 minute left'
  return `${s} seconds left`
})

const messagesOpen = ref(false)
</script>

<template>
  <header class="ix-header">
    <NuxtLink
      :to="chrome.leaveTo.value"
      class="ix-logo"
      aria-label="Mockmee"
    >
      <span>mockmee</span>
    </NuxtLink>
    <div class="ix-candidate">
      <strong data-testid="candidate">{{ candidate || 'Test taker ID' }}</strong>
      <small v-if="status" data-testid="exam-status"><UIcon v-if="statusIcon" :name="statusIcon" class="size-3.5" />{{ status }}</small>
    </div>

    <div v-if="started" class="ix-timer" :class="{ 'is-low': seconds <= 300 }" role="timer" aria-live="off" data-testid="time-left">
      <UIcon name="i-lucide-clock" class="size-4" />{{ timeLeft }}
    </div>

    <div class="ix-icons">
      <span
        class="ix-icon"
        :class="{ 'is-off': connection.off }"
        :title="connection.label"
        :aria-label="connection.label"
        role="img"
        data-testid="save-state"
        :data-state="saveState"
      >
        <UIcon :name="connection.off ? 'i-lucide-wifi-off' : 'i-lucide-wifi'" />
      </span>
      <button type="button" class="ix-icon" aria-label="Messages" title="Messages" @click="messagesOpen = !messagesOpen">
        <UIcon name="i-lucide-bell" />
        <div v-if="messagesOpen" class="ix-popover" role="dialog" aria-label="Messages" @click.stop>
          No messages
        </div>
      </button>
      <button type="button" class="ix-icon" aria-label="Options" title="Options" data-testid="options" @click="chrome.optionsOpen.value = true">
        <UIcon name="i-lucide-menu" />
      </button>
      <button
        type="button"
        class="ix-icon"
        :aria-label="chrome.notesOpen.value ? 'Hide notes' : 'Show notes'"
        :title="chrome.notesOpen.value ? 'Hide notes' : 'Show notes'"
        data-testid="notes-toggle"
        @click="chrome.notesOpen.value = !chrome.notesOpen.value"
      >
        <UIcon name="i-lucide-square-pen" />
      </button>
    </div>
  </header>
</template>
