<script setup lang="ts">
import type { Attachment } from '~/types/community'
import { MAX_ATTACHMENTS, MAX_BODY_LENGTH } from '~/types/community'
import { htmlToText } from '~/utils/html-text'

// Shared by the feed (new post) and the thread page (reply). `withTitle` is the
// only difference between the two.
const props = withDefaults(defineProps<{
  withTitle?: boolean
  placeholder?: string
  submitLabel?: string
  /** Tailwind min-height for the editor surface. */
  minHeight?: string
}>(), {
  withTitle: false,
  placeholder: 'Share something with the community…',
  submitLabel: 'Post',
  minHeight: 'min-h-32'
})

const emit = defineEmits<{
  submit: [payload: { title: string | null, body: string, attachments: Attachment[] }]
}>()

const submitting = defineModel<boolean>('submitting', { default: false })

const toast = useToast()
const { upload, uploading } = useS3Upload()

const title = ref('')
const body = ref('')
const attachments = ref<Attachment[]>([])
const imageInput = ref<HTMLInputElement>()
const audioInput = ref<HTMLInputElement>()
// Recording, or holding a take that has not been attached yet — submitting now
// would silently discard it.
const recorderActive = ref(false)

const stagedImages = computed(() => attachments.value.filter(a => a.type === 'image'))
const stagedAudios = computed(() => attachments.value.filter(a => a.type === 'audio'))

const full = computed(() => attachments.value.length >= MAX_ATTACHMENTS)
// An "empty" TipTap document is still `<p></p>`, so test the visible text.
const hasText = computed(() => htmlToText(body.value).length > 0)
const canSubmit = computed(() =>
  hasText.value
  && body.value.length <= MAX_BODY_LENGTH
  && !uploading.value
  && !recorderActive.value
  && !submitting.value
)

function remaining() {
  return MAX_ATTACHMENTS - attachments.value.length
}

async function attach(file: Blob, type: Attachment['type'], fileName?: string) {
  if (full.value) {
    toast.add({ title: `At most ${MAX_ATTACHMENTS} attachments`, color: 'warning' })
    return
  }
  try {
    const url = await upload(file, 'community', fileName)
    attachments.value.push({ type, url })
  } catch (e) {
    toast.add({ title: 'Upload failed', description: (e as Error).message, color: 'error' })
  }
}

async function onFiles(event: Event, type: Attachment['type']) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? []).slice(0, remaining())
  for (const file of files) await attach(file, type, file.name)
  // Reset so picking the same file twice still fires `change`.
  input.value = ''
}

function onRecorded(recorded: Blob) {
  attach(recorded, 'audio', 'recording.webm')
}

// Keyed by url: images and audio render in separate lists, so an index into
// either one no longer addresses `attachments`.
function removeAttachment(url: string) {
  attachments.value = attachments.value.filter(a => a.url !== url)
}

function submit() {
  if (!canSubmit.value) return
  emit('submit', {
    title: props.withTitle && title.value.trim() ? title.value.trim() : null,
    // Raw editor HTML; the server sanitizes it before storing.
    body: body.value,
    attachments: [...attachments.value]
  })
}

/** Called by the parent once the request succeeded. */
function reset() {
  title.value = ''
  body.value = ''
  attachments.value = []
}
defineExpose({ reset })
</script>

<template>
  <UCard>
    <div class="space-y-3">
      <UInput
        v-if="withTitle"
        v-model="title"
        placeholder="Title"
        size="lg"
      />

      <RichEditor
        v-model="body"
        :placeholder="placeholder"
        :min-height="minHeight"
      />

      <!-- Staged images -->
      <div
        v-if="stagedImages.length"
        class="flex flex-wrap gap-2"
      >
        <div
          v-for="a in stagedImages"
          :key="a.url"
          class="relative"
        >
          <img
            :src="a.url"
            alt=""
            class="size-20 rounded-lg border border-default object-cover"
          >
          <UButton
            icon="i-lucide-x"
            color="neutral"
            size="xs"
            class="absolute -right-1.5 -top-1.5 rounded-full"
            aria-label="Remove attachment"
            @click="removeAttachment(a.url)"
          />
        </div>
      </div>

      <!-- Staged audio, previewed exactly as it will appear once posted -->
      <div
        v-for="a in stagedAudios"
        :key="a.url"
        class="flex items-center gap-2"
      >
        <WaveAudioPlayer
          :src="a.url"
          class="flex-1"
        />
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Remove attachment"
          @click="removeAttachment(a.url)"
        />
      </div>

      <div
        v-if="uploading"
        class="flex items-center gap-2 text-sm text-muted"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-4 animate-spin"
        />
        Uploading…
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <input
          ref="imageInput"
          type="file"
          accept="image/*"
          multiple
          class="hidden"
          @change="onFiles($event, 'image')"
        >
        <input
          ref="audioInput"
          type="file"
          accept="audio/*"
          multiple
          class="hidden"
          @change="onFiles($event, 'audio')"
        >

        <UButton
          icon="i-lucide-image"
          color="neutral"
          variant="ghost"
          size="sm"
          label="Image"
          :disabled="full || uploading"
          @click="imageInput?.click()"
        />
        <UButton
          icon="i-lucide-paperclip"
          color="neutral"
          variant="ghost"
          size="sm"
          label="Audio file"
          :disabled="full || uploading"
          @click="audioInput?.click()"
        />
        <VoiceRecorder
          v-model:active="recorderActive"
          :disabled="full || uploading"
          @recorded="onRecorded"
        />

        <span class="text-xs text-muted">
          {{ attachments.length }}/{{ MAX_ATTACHMENTS }}
        </span>

        <UButton
          class="ml-auto"
          :label="submitLabel"
          :loading="submitting"
          :disabled="!canSubmit"
          @click="submit"
        />
      </div>
    </div>
  </UCard>
</template>
