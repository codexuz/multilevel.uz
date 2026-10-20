<script setup lang="ts">
import { mediaUrl, uploadFile } from '~/services/http'

const props = withDefaults(defineProps<{
  kind?: 'audio' | 'image' | 'video' | 'document' | 'file'
  accept?: string
  placeholder?: string
  maxSizeMb?: number
  /** The playable address of a stored reference, as the API signed it. */
  url?: string | null
}>(), { kind: 'file', maxSizeMb: 200 })

const model = defineModel<string | null | undefined>()
const toast = useToast()
const file = ref<File | null>(null)
const progress = ref<number | null>(null)
// A stored reference ("file:<id>") is not an address; preview what was just uploaded, or what the API signed.
const uploadedUrl = ref<string | null>(null)
const previewSrc = computed(() => {
  if (!model.value) return null
  if (!model.value.startsWith('file:')) return model.value
  return uploadedUrl.value ?? (props.url ? mediaUrl(props.url) : null)
})

const ACCEPT = { audio: 'audio/*', image: 'image/*', video: 'video/*', document: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip,.rar,.7z', file: '*' }
const ICONS = { audio: 'i-lucide-file-audio', image: 'i-lucide-image-up', video: 'i-lucide-file-video', document: 'i-lucide-file-up', file: 'i-lucide-upload' }
const acceptAttr = computed(() => props.accept ?? ACCEPT[props.kind])
const uploadIcon = computed(() => ICONS[props.kind])

watch(file, async (f) => {
  if (!f) return
  if (f.size > props.maxSizeMb * 1024 * 1024) {
    toast.add({ title: `File must be smaller than ${props.maxSizeMb}MB`, color: 'error' })
    file.value = null
    return
  }
  progress.value = 0
  try {
    // The paper keeps the reference ("file:<id>"); the API turns it into a playable address.
    const uploaded = await uploadFile(f, { onProgress: p => (progress.value = p) })
    uploadedUrl.value = mediaUrl(uploaded.url)
    model.value = uploaded.ref
    toast.add({ title: `${f.name} uploaded`, color: 'success' })
  } catch (e) {
    toast.add({ title: 'Upload failed', description: errorMessage(e), color: 'error' })
  } finally {
    progress.value = null
    file.value = null
  }
})
</script>

<template>
  <div class="space-y-2">
    <div class="flex gap-2">
      <UInput
        :model-value="model ?? ''"
        :placeholder="placeholder ?? 'Paste a URL or upload a file'"
        icon="i-lucide-link"
        class="flex-1"
        @update:model-value="v => (model = String(v) || null)"
      />
      <UFileUpload
        v-model="file"
        :accept="acceptAttr"
        :preview="false"
        class="w-auto"
      >
        <template #default="{ open }">
          <UButton
            :icon="uploadIcon"
            label="Upload"
            color="neutral"
            variant="outline"
            :loading="progress !== null"
            @click="open()"
          />
        </template>
      </UFileUpload>
      <UButton
        v-if="model"
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        aria-label="Clear"
        @click="() => { model = null }"
      />
    </div>
    <UProgress
      v-if="progress !== null"
      :model-value="progress"
      size="xs"
    />
    <template v-else-if="previewSrc">
      <AudioPlayer
        v-if="kind === 'audio'"
        :src="previewSrc"
      />
      <img
        v-else-if="kind === 'image'"
        :src="previewSrc"
        alt="Preview"
        class="max-h-48 rounded-md ring ring-default object-contain"
      >
      <slot
        name="preview"
        :url="previewSrc"
      />
    </template>
  </div>
</template>
