<script setup lang="ts">
const { t } = useI18n()
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
    case 'saved': return { label: t('exam.saved'), icon: 'i-lucide-cloud-check', class: 'text-muted' }
    case 'pending':
    case 'saving': return { label: t('exam.saving'), icon: 'i-lucide-cloud-upload', class: 'text-muted' }
    case 'offline': return { label: t('exam.offline'), icon: 'i-lucide-cloud-off', class: 'text-warning' }
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
        :label="t('common.back')"
        :aria-label="t('common.back')"
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
        :label="t('common.start')"
        color="error"
        class="px-5"
        @click="emit('start')"
      />
    </div>

    <div class="flex items-center gap-1">
      <UButton
        v-if="started && canSubmit"
        icon="i-lucide-send"
        :label="t('exam.submit')"
        :aria-label="t('exam.submit')"
        color="neutral"
        :ui="{ label: 'max-sm:hidden' }"
        @click="() => { confirmOpen = true }"
      />
      <UTooltip :text="fullscreen ? t('exam.exitFullscreen') : t('exam.fullscreen')">
        <UButton
          :icon="fullscreen ? 'i-lucide-minimize-2' : 'i-lucide-maximize-2'"
          color="neutral"
          variant="ghost"
          class="max-sm:hidden"
          @click="toggleFullscreen"
        />
      </UTooltip>
      <UTooltip :text="t('exam.notes')">
        <UButton
          icon="i-lucide-message-square-text"
          color="neutral"
          variant="ghost"
          @click="emit('notes')"
        />
      </UTooltip>
      <UTooltip :text="t('exam.options')">
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
      :title="t('exam.leaveTest')"
      :ui="{ content: 'max-w-sm', footer: 'justify-end' }"
    >
      <template #body>
        <UEmpty
          icon="i-lucide-triangle-alert"
          :title="t('exam.leaveSure')"
          :description="t('exam.leaveText')"
          variant="naked"
        />
      </template>
      <template #footer>
        <UButton
          :label="t('common.cancel')"
          color="neutral"
          variant="outline"
          @click="() => { leaveOpen = false }"
        />
        <UButton
          :label="t('exam.leave')"
          icon="i-lucide-arrow-left"
          color="error"
          @click="leave"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="confirmOpen"
      :title="t('exam.submitTest')"
      :ui="{ content: 'max-w-sm', footer: 'justify-end' }"
    >
      <template #body>
        <UEmpty
          icon="i-lucide-triangle-alert"
          :title="t('exam.submitSure')"
          :description="t('exam.submitText')"
          variant="naked"
        />
      </template>
      <template #footer>
        <UButton
          :label="t('common.cancel')"
          color="neutral"
          variant="outline"
          @click="() => { confirmOpen = false }"
        />
        <UButton
          :label="t('exam.confirmSubmit')"
          icon="i-lucide-send"
          color="error"
          @click="confirmOpen = false; emit('submit')"
        />
      </template>
    </UModal>
  </header>
</template>
