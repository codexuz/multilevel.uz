<script setup lang="ts">
const props = withDefaults(defineProps<{
  initialSeconds: number
  running: boolean
  started: boolean
  canSubmit?: boolean
  leaveTo?: string
}>(), { canSubmit: true })

const emit = defineEmits<{
  start: []
  timeUp: []
  submit: []
  notes: []
}>()

const router = useRouter()
// Whether the answers have reached the server, when the page sitting the attempt keeps them.
const saveState = inject(SAVE_STATE, null)
const saveBadge = computed(() => {
  switch (saveState?.value) {
    case 'saved': return { label: 'Saved', icon: 'i-lucide-cloud-check', class: 'text-muted' }
    case 'pending':
    case 'saving': return { label: 'Saving…', icon: 'i-lucide-cloud-upload', class: 'text-muted' }
    case 'offline': return { label: 'Offline — answers kept on this computer', icon: 'i-lucide-cloud-off', class: 'text-warning' }
    default: return null
  }
})
const seconds = ref(props.initialSeconds)
const optionsOpen = ref(false)
const confirmOpen = ref(false)
const leaveOpen = ref(false)
const fullscreen = ref(false)

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

const timeColor = computed(() => seconds.value <= 60 ? 'error' : seconds.value <= 300 ? 'warning' : 'neutral')

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.()
  else document.exitFullscreen?.()
}
onMounted(() => document.addEventListener('fullscreenchange', onFs))
onBeforeUnmount(() => document.removeEventListener('fullscreenchange', onFs))
function onFs() {
  fullscreen.value = !!document.fullscreenElement
}

function leave() {
  leaveOpen.value = false
  if (props.leaveTo) router.push(props.leaveTo)
  else router.back()
}
</script>

<template>
  <header class="h-14 shrink-0 flex items-center justify-between gap-2 px-2 sm:px-4 border-b border-default bg-default sticky top-0 z-20">
    <div class="flex items-center gap-2 min-w-0">
      <UButton
        icon="i-lucide-arrow-left"
        label="Back"
        aria-label="Back"
        color="neutral"
        variant="ghost"
        :ui="{ label: 'max-sm:hidden' }"
        @click="() => { leaveOpen = true }"
      />
      <UBadge
        label="Multilevel"
        color="primary"
        variant="solid"
        class="font-bold"
      />
      <span
        v-if="saveBadge && started"
        class="flex items-center gap-1 text-xs min-w-0"
        :class="saveBadge.class"
        :title="saveBadge.label"
        data-testid="save-state"
        :data-state="saveState"
      >
        <UIcon
          :name="saveBadge.icon"
          class="size-4 shrink-0"
        />
        <span class="truncate max-md:hidden">{{ saveBadge.label }}</span>
      </span>
    </div>

    <div class="flex items-center gap-2">
      <UBadge
        :label="formatTime(seconds)"
        icon="i-lucide-timer"
        :color="timeColor"
        variant="subtle"
        size="lg"
        class="tabular-nums font-bold tracking-wider"
      />
      <UButton
        v-if="!started"
        label="Start"
        color="error"
        class="px-5"
        @click="emit('start')"
      />
    </div>

    <div class="flex items-center gap-1">
      <UButton
        v-if="started && canSubmit"
        icon="i-lucide-send"
        label="Submit"
        aria-label="Submit"
        color="neutral"
        :ui="{ label: 'max-sm:hidden' }"
        @click="() => { confirmOpen = true }"
      />
      <UTooltip :text="fullscreen ? 'Exit fullscreen' : 'Fullscreen'">
        <UButton
          :icon="fullscreen ? 'i-lucide-minimize-2' : 'i-lucide-maximize-2'"
          color="neutral"
          variant="ghost"
          class="max-sm:hidden"
          @click="toggleFullscreen"
        />
      </UTooltip>
      <UTooltip text="Notes">
        <UButton
          icon="i-lucide-message-square-text"
          color="neutral"
          variant="ghost"
          @click="emit('notes')"
        />
      </UTooltip>
      <UTooltip text="Options">
        <UButton
          icon="i-lucide-menu"
          color="neutral"
          variant="ghost"
          @click="() => { optionsOpen = true }"
        />
      </UTooltip>
    </div>

    <ExamOptionsModal v-model:open="optionsOpen" />

    <UModal
      v-model:open="leaveOpen"
      title="Leave test"
      :ui="{ content: 'max-w-sm', footer: 'justify-end' }"
    >
      <template #body>
        <UEmpty
          icon="i-lucide-triangle-alert"
          title="Are you sure you want to leave this test?"
          description="Your progress may not be saved."
          variant="naked"
        />
      </template>
      <template #footer>
        <UButton
          label="Cancel"
          color="neutral"
          variant="outline"
          @click="() => { leaveOpen = false }"
        />
        <UButton
          label="Leave"
          icon="i-lucide-arrow-left"
          color="error"
          @click="leave"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="confirmOpen"
      title="Submit test"
      :ui="{ content: 'max-w-sm', footer: 'justify-end' }"
    >
      <template #body>
        <UEmpty
          icon="i-lucide-triangle-alert"
          title="Are you sure you want to submit your test?"
          description="You won't be able to change your answers after submission."
          variant="naked"
        />
      </template>
      <template #footer>
        <UButton
          label="Cancel"
          color="neutral"
          variant="outline"
          @click="() => { confirmOpen = false }"
        />
        <UButton
          label="Confirm submit"
          icon="i-lucide-send"
          color="error"
          @click="confirmOpen = false; emit('submit')"
        />
      </template>
    </UModal>
  </header>
</template>
