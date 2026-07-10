<script setup lang="ts">
// Telegram-style capture: record with a live level meter, then preview the take
// before handing the blob to the parent. Nothing is uploaded here.
const emit = defineEmits<{ recorded: [blob: Blob] }>()

const props = withDefaults(defineProps<{
  disabled?: boolean
  /** Live meter width, in bars. */
  bars?: number
}>(), { disabled: false, bars: 48 })

// True while recording or while an un-attached take is being previewed, so the
// parent can block submitting and losing it.
const active = defineModel<boolean>('active', { default: false })

const toast = useToast()
const { recording, elapsed, blob, url, error, levels, start, stop, reset } = useRecorder()

// The tail of the level buffer, right-aligned like a rolling oscilloscope.
const meter = computed(() => {
  const tail = levels.value.slice(-props.bars)
  return [...Array(Math.max(0, props.bars - tail.length)).fill(0), ...tail] as number[]
})

const hasTake = computed(() => !!blob.value && !!url.value)

watch([recording, hasTake], () => {
  active.value = recording.value || hasTake.value
}, { immediate: true })

watch(error, (message) => {
  if (message) toast.add({ title: 'Recording failed', description: message, color: 'error' })
})

function fmt(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function accept() {
  if (blob.value) emit('recorded', blob.value)
  reset()
}

function discard() {
  reset()
}
</script>

<template>
  <!-- Idle -->
  <UButton
    v-if="!recording && !hasTake"
    icon="i-lucide-mic"
    color="neutral"
    variant="ghost"
    size="sm"
    label="Record"
    :disabled="disabled"
    @click="start"
  />

  <!-- Recording -->
  <div
    v-else-if="recording"
    class="flex w-full items-center gap-3 rounded-full border border-error/40 bg-error/5 px-3 py-2"
  >
    <span class="size-2.5 shrink-0 animate-pulse rounded-full bg-error" />

    <div class="flex h-8 flex-1 items-center gap-[2px] overflow-hidden">
      <span
        v-for="(level, i) in meter"
        :key="i"
        class="w-[3px] shrink-0 rounded-full bg-error/70"
        :style="{ height: `${Math.max(8, Math.round(level * 100))}%` }"
      />
    </div>

    <span class="shrink-0 text-xs tabular-nums text-muted">{{ fmt(elapsed) }}</span>

    <UButton
      icon="i-lucide-square"
      color="error"
      size="sm"
      :ui="{ base: 'rounded-full' }"
      aria-label="Stop recording"
      @click="stop"
    />
  </div>

  <!-- Preview the take -->
  <div
    v-else
    class="flex w-full items-center gap-2"
  >
    <WaveAudioPlayer
      :key="url!"
      :src="url!"
      class="flex-1"
    />
    <UButton
      icon="i-lucide-trash-2"
      color="neutral"
      variant="ghost"
      size="sm"
      aria-label="Discard recording"
      @click="discard"
    />
    <UButton
      icon="i-lucide-check"
      color="primary"
      size="sm"
      aria-label="Attach recording"
      @click="accept"
    />
  </div>
</template>
