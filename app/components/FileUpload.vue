<script setup lang="ts">
type Purpose = 'test-audio' | 'test-asset' | 'recording' | 'avatar'

const props = defineProps<{
  modelValue?: string | null
  purpose: Purpose
  accept?: string
  label?: string
  preview?: 'audio' | 'image' | 'video' | 'none'
  /** Also offer a field for pasting an external URL instead of uploading. */
  allowUrl?: boolean
  urlPlaceholder?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [string | null] }>()

const { upload, uploading, progress } = useS3Upload()
const toast = useToast()
const input = ref<HTMLInputElement>()

// Local draft so the parent only sees a committed URL, not every keystroke.
const urlDraft = ref(props.modelValue ?? '')
watch(() => props.modelValue, (v) => {
  urlDraft.value = v ?? ''
})

function commitUrl() {
  const url = urlDraft.value.trim()
  emit('update:modelValue', url || null)
}

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
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center gap-2">
      <UButton
        :label="label || 'Upload file'"
        icon="i-lucide-upload"
        color="neutral"
        variant="outline"
        :loading="uploading"
        @click="input?.click()"
      />
      <UButton
        v-if="modelValue"
        icon="i-lucide-x"
        color="error"
        variant="ghost"
        size="sm"
        @click="emit('update:modelValue', null)"
      />
      <span
        v-if="uploading"
        class="text-xs text-muted"
      >{{ progress }}%</span>
    </div>
    <input
      ref="input"
      type="file"
      :accept="accept"
      class="hidden"
      @change="onPick"
    >

    <div
      v-if="allowUrl"
      class="flex items-center gap-2"
    >
      <UInput
        v-model="urlDraft"
        class="flex-1"
        size="sm"
        icon="i-lucide-link"
        :placeholder="urlPlaceholder || 'Or paste a URL…'"
        @blur="commitUrl"
        @keydown.enter.prevent="commitUrl"
      />
      <UButton
        v-if="urlDraft !== (modelValue ?? '')"
        label="Use URL"
        size="sm"
        color="neutral"
        variant="soft"
        @click="commitUrl"
      />
    </div>

    <template v-if="modelValue && preview !== 'none'">
      <audio
        v-if="preview === 'audio'"
        :src="modelValue"
        controls
        class="w-full h-9"
      />
      <img
        v-else-if="preview === 'image'"
        :src="modelValue"
        alt="preview"
        class="max-h-32 rounded-md border border-default"
      >
      <video
        v-else-if="preview === 'video'"
        :src="modelValue"
        controls
        class="max-h-48 w-full rounded-md border border-default bg-black"
      />
      <p
        v-else
        class="text-xs text-muted truncate"
      >
        {{ modelValue }}
      </p>
    </template>
  </div>
</template>
