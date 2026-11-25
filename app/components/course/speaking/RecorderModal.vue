<script setup lang="ts">
import type { SpeakingQuestionItem } from './QuestionModal.vue'
import { uploadFile } from '~/services/http'

const props = defineProps<{
  courseId: string
  question: SpeakingQuestionItem | null
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ published: [] }>()

const { t } = useI18n()
const toast = useToast()
const rec = useRecorder()

const note = ref('')
const uploading = ref(false)
const uploadPct = ref(0)

watch(open, (isOpen) => {
  if (!isOpen) {
    rec.stop()
    rec.reset()
    note.value = ''
    uploading.value = false
    uploadPct.value = 0
  }
})

const latestLevel = computed(() => {
  const arr = rec.levels.value
  return arr.length ? Math.round(arr[arr.length - 1]! * 100) : 0
})

const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

async function publish() {
  if (!props.question || !rec.blob.value || uploading.value) return
  uploading.value = true
  uploadPct.value = 0
  try {
    const uploaded = await uploadFile(rec.blob.value, {
      purpose: 'recording',
      onProgress: pct => (uploadPct.value = pct)
    })
    const res = await $fetch<{ xpGained?: number }>(`/api/courses/${props.courseId}/speaking/recordings`, {
      method: 'POST',
      body: {
        questionId: props.question.id,
        audioUrl: uploaded.url,
        durationSeconds: Math.max(1, rec.elapsed.value),
        note: note.value.trim() || null
      }
    })
    await refreshXp()
    toast.add({
      title: t('speakingStudio.publishedToast'),
      description: res.xpGained ? t('speakingStudio.publishedXp', { n: res.xpGained }) : undefined,
      color: 'success'
    })
    open.value = false
    emit('published')
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('speakingStudio.recordModalTitle')"
    :ui="{ content: 'sm:max-w-xl' }"
  >
    <template #body>
      <UPageList
        v-if="question"
        class="gap-4"
      >
        <!-- Active Prompt Preview -->
        <UCard
          variant="subtle"
          :ui="{ body: 'flex flex-col gap-2.5' }"
        >
          <UPageList class="flex-row flex-wrap items-center gap-1.5">
            <UBadge
              v-if="question.partLabel"
              :label="question.partLabel"
              color="primary"
              variant="subtle"
              size="xs"
            />
            <UBadge
              v-if="question.suggestedSeconds"
              icon="i-lucide-timer"
              :label="t('speakingStudio.suggestedTime', { time: fmtTime(question.suggestedSeconds) })"
              color="info"
              variant="subtle"
              size="xs"
            />
          </UPageList>
          <UPageHeader
            :title="question.title"
            :description="question.prompt"
            :ui="{ root: 'border-0 py-0', title: 'text-base sm:text-lg', description: 'text-sm whitespace-pre-line mt-1' }"
          />
          <UAlert
            v-if="question.tips"
            color="neutral"
            variant="soft"
            icon="i-lucide-lightbulb"
            :description="question.tips"
          />
        </UCard>

        <!-- Microphone Error -->
        <UAlert
          v-if="rec.error.value"
          color="error"
          variant="subtle"
          icon="i-lucide-mic-off"
          :title="t('speakingStudio.micDenied')"
          :description="rec.error.value"
        />

        <!-- Recorder Controls -->
        <UCard
          variant="outline"
          :ui="{ body: 'flex flex-col gap-3' }"
        >
          <UPageList class="flex-row flex-wrap items-center justify-between gap-2">
            <UBadge
              v-if="rec.recording.value"
              icon="i-lucide-radio"
              :label="t('speakingStudio.recordingNow', { time: fmtTime(rec.elapsed.value) })"
              color="error"
              variant="soft"
              size="md"
            />
            <UBadge
              v-else-if="rec.url.value"
              icon="i-lucide-check-circle-2"
              :label="fmtTime(rec.elapsed.value)"
              color="success"
              variant="soft"
              size="md"
            />
            <UBadge
              v-else
              icon="i-lucide-mic"
              :label="t('speakingStudio.startRecording')"
              color="neutral"
              variant="subtle"
              size="md"
            />

            <UPageList class="flex-row items-center gap-2">
              <UButton
                v-if="!rec.recording.value && !rec.url.value"
                :label="t('speakingStudio.startRecording')"
                icon="i-lucide-mic"
                color="primary"
                @click="rec.start"
              />
              <UButton
                v-else-if="rec.recording.value"
                :label="t('speakingStudio.stopRecording')"
                icon="i-lucide-square"
                color="error"
                @click="rec.stop"
              />
              <UButton
                v-else
                :label="t('speakingStudio.reRecord')"
                icon="i-lucide-rotate-cw"
                color="neutral"
                variant="outline"
                :disabled="uploading"
                @click="rec.start"
              />
            </UPageList>
          </UPageList>

          <UProgress
            v-if="rec.recording.value"
            :model-value="latestLevel"
            color="error"
            size="sm"
          />

          <template v-if="rec.url.value && !rec.recording.value">
            <UBadge
              :label="t('speakingStudio.previewLabel')"
              color="neutral"
              variant="subtle"
              size="xs"
              class="self-start"
            />
            <MediaWaveAudio
              :src="rec.url.value"
              :title="question.title"
            />
          </template>
        </UCard>

        <!-- Optional Note -->
        <UFormField
          v-if="rec.url.value && !rec.recording.value"
          :label="t('speakingStudio.noteLabel')"
        >
          <UTextarea
            v-model="note"
            :rows="2"
            :placeholder="t('speakingStudio.notePlaceholder')"
            :disabled="uploading"
            class="w-full"
          />
        </UFormField>

        <!-- Upload Progress -->
        <UAlert
          v-if="uploading"
          color="primary"
          variant="subtle"
          icon="i-lucide-upload-cloud"
          :title="t('speakingStudio.uploading', { pct: uploadPct })"
        />
        <UProgress
          v-if="uploading"
          :model-value="uploadPct"
          color="primary"
          size="sm"
        />

        <!-- Actions -->
        <UPageList class="flex-row items-center justify-end gap-2">
          <UButton
            :label="t('common.cancel')"
            color="neutral"
            variant="ghost"
            :disabled="uploading"
            @click="open = false"
          />
          <UButton
            :label="t('speakingStudio.publishRecording')"
            icon="i-lucide-send"
            :loading="uploading"
            :disabled="!rec.blob.value || rec.recording.value"
            @click="publish"
          />
        </UPageList>
      </UPageList>
    </template>
  </UModal>
</template>
