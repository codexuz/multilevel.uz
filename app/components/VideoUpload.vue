<script setup lang="ts">
// Video source picker with three modes: upload a file, paste a direct URL, or
// embed a YouTube link. All three resolve to a single URL string (modelValue).
const props = withDefaults(defineProps<{
  modelValue?: string | null
  label?: string
  purpose?: 'test-audio' | 'test-asset' | 'recording' | 'avatar'
}>(), {
  modelValue: null,
  label: 'Video',
  purpose: 'test-asset'
})
const emit = defineEmits<{ 'update:modelValue': [string | null] }>()

type Mode = 'upload' | 'url' | 'youtube'
const MODES: { value: Mode, label: string, icon: string }[] = [
  { value: 'upload', label: 'Upload', icon: 'i-lucide-upload' },
  { value: 'url', label: 'URL', icon: 'i-lucide-link' },
  { value: 'youtube', label: 'YouTube', icon: 'i-lucide-youtube' }
]

// Pick the initial tab based on the existing value.
const mode = ref<Mode>(
  isYoutubeUrl(props.modelValue) ? 'youtube' : props.modelValue ? 'url' : 'upload'
)

const { upload, uploading, progress } = useS3Upload()
const toast = useToast()
const input = ref<HTMLInputElement>()

async function onPick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const url = await upload(file, props.purpose, file.name)
    emit('update:modelValue', url)
    toast.add({ title: 'Uploaded', color: 'success', icon: 'i-lucide-check' })
  } catch (err) {
    toast.add({ title: 'Upload failed', description: (err as Error).message, color: 'error' })
  } finally {
    if (input.value) input.value.value = ''
  }
}

// Bound to the URL / YouTube text fields; writes straight through to modelValue.
const urlValue = computed({
  get: () => props.modelValue ?? '',
  set: (v: string) => emit('update:modelValue', v.trim() || null)
})

const ytInvalid = computed(() =>
  mode.value === 'youtube' && !!props.modelValue && !isYoutubeUrl(props.modelValue)
)

function clear() {
  emit('update:modelValue', null)
}
</script>

<template>
  <div class="space-y-3">
    <!-- Mode switch -->
    <div class="flex gap-1">
      <UButton
        v-for="m in MODES"
        :key="m.value"
        :label="m.label"
        :icon="m.icon"
        size="sm"
        :color="mode === m.value ? 'primary' : 'neutral'"
        :variant="mode === m.value ? 'solid' : 'outline'"
        @click="mode = m.value"
      />
      <div class="flex-1" />
      <UButton
        v-if="modelValue"
        icon="i-lucide-x"
        label="Clear"
        size="sm"
        color="error"
        variant="ghost"
        @click="clear"
      />
    </div>

    <!-- Upload -->
    <div v-if="mode === 'upload'">
      <UButton
        :label="label ? `Upload ${label.toLowerCase()}` : 'Upload video'"
        icon="i-lucide-upload"
        color="neutral"
        variant="outline"
        :loading="uploading"
        @click="input?.click()"
      />
      <span
        v-if="uploading"
        class="ml-2 text-xs text-muted"
      >{{ progress }}%</span>
      <input
        ref="input"
        type="file"
        accept="video/*"
        class="hidden"
        @change="onPick"
      >
    </div>

    <!-- Direct URL -->
    <UInput
      v-else-if="mode === 'url'"
      v-model="urlValue"
      class="w-full"
      icon="i-lucide-link"
      placeholder="https://cdn.example.com/explanation.mp4"
    />

    <!-- YouTube -->
    <div
      v-else
      class="space-y-1"
    >
      <UInput
        v-model="urlValue"
        class="w-full"
        icon="i-lucide-youtube"
        placeholder="https://youtu.be/… or https://youtube.com/watch?v=…"
        :color="ytInvalid ? 'error' : undefined"
      />
      <p
        v-if="ytInvalid"
        class="text-xs text-error"
      >
        That doesn't look like a YouTube link.
      </p>
    </div>

    <!-- Preview -->
    <VideoPlayer
      v-if="modelValue"
      :src="modelValue"
      class="max-w-md"
    />
  </div>
</template>
