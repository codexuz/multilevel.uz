<script setup lang="ts">
const props = defineProps<{
  src: string
  fileName?: string
  compact?: boolean
}>()

const audio = ref<HTMLAudioElement>()
const playing = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(100)
const failed = ref(false)

function fmt(s: number) {
  if (!Number.isFinite(s) || s < 0) return '0:00'
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

watch(() => props.src, () => {
  playing.value = false
  currentTime.value = 0
  failed.value = false
  audio.value?.load()
})

function toggle() {
  if (!audio.value) return
  if (playing.value) audio.value.pause()
  else audio.value.play().catch(() => (failed.value = true))
}

function restart() {
  if (!audio.value) return
  audio.value.currentTime = 0
  audio.value.play().catch(() => (failed.value = true))
}

function seek(v?: number | number[]) {
  const value = Array.isArray(v) ? v[0] : v
  if (audio.value && value != null) audio.value.currentTime = value
}

watch(volume, (v) => {
  if (audio.value) audio.value.volume = v / 100
})

defineExpose({ play: () => audio.value?.play(), pause: () => audio.value?.pause(), element: audio })
</script>

<template>
  <UCard
    :variant="compact ? 'soft' : 'outline'"
    :ui="{ body: compact ? 'p-2 sm:p-2' : 'p-3 sm:p-4' }"
  >
    <audio
      ref="audio"
      :src="src"
      preload="metadata"
      class="hidden"
      @loadedmetadata="duration = audio?.duration || 0"
      @timeupdate="currentTime = audio?.currentTime || 0"
      @play="playing = true"
      @pause="playing = false"
      @ended="playing = false"
      @error="failed = true"
    />
    <UAlert
      v-if="failed"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Unable to load audio"
      :description="fileName"
    />
    <div
      v-else
      class="flex items-center gap-3"
    >
      <UButton
        :icon="playing ? 'i-lucide-pause' : 'i-lucide-play'"
        :size="compact ? 'sm' : 'md'"
        class="rounded-full"
        square
        @click="toggle"
      />
      <div class="flex-1 min-w-0 space-y-1">
        <UBadge
          v-if="fileName && !compact"
          :label="fileName"
          color="neutral"
          variant="soft"
          size="sm"
          class="max-w-full truncate"
        />
        <USlider
          :model-value="currentTime"
          :max="duration || 1"
          :step="0.1"
          size="sm"
          @update:model-value="seek"
        />
      </div>
      <UBadge
        :label="`${fmt(currentTime)} / ${fmt(duration)}`"
        color="neutral"
        variant="outline"
        size="sm"
        class="tabular-nums"
      />
      <UPopover v-if="!compact">
        <UButton
          icon="i-lucide-volume-2"
          color="neutral"
          variant="ghost"
          square
        />
        <template #content>
          <USlider
            v-model="volume"
            orientation="vertical"
            class="h-28 m-3"
          />
        </template>
      </UPopover>
      <UButton
        icon="i-lucide-rotate-ccw"
        color="neutral"
        variant="ghost"
        square
        @click="restart"
      />
    </div>
  </UCard>
</template>
