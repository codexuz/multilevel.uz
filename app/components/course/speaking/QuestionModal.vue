<script setup lang="ts">
export interface SpeakingQuestionItem {
  id: string
  position: number
  title: string
  prompt: string
  tips: string | null
  partLabel: string | null
  suggestedSeconds: number | null
  recordingsCount: number
  myRecordingsCount: number
}

const props = defineProps<{
  courseId: string
  question?: SpeakingQuestionItem | null
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [] }>()

const { t } = useI18n()
const toast = useToast()

const form = reactive({
  title: '',
  partLabel: '',
  suggestedSeconds: 60 as number | null,
  prompt: '',
  tips: ''
})

watch([open, () => props.question], ([isOpen, q]) => {
  if (!isOpen) return
  if (q) {
    Object.assign(form, {
      title: q.title,
      partLabel: q.partLabel ?? '',
      suggestedSeconds: q.suggestedSeconds ?? null,
      prompt: q.prompt,
      tips: q.tips ?? ''
    })
  } else {
    Object.assign(form, {
      title: '',
      partLabel: '',
      suggestedSeconds: 60,
      prompt: '',
      tips: ''
    })
  }
}, { immediate: true })

const saving = ref(false)
async function save() {
  if (!form.title.trim() || !form.prompt.trim()) return
  saving.value = true
  try {
    const body = {
      title: form.title.trim(),
      prompt: form.prompt.trim(),
      partLabel: form.partLabel.trim() || null,
      suggestedSeconds: form.suggestedSeconds || null,
      tips: form.tips.trim() || null
    }
    if (props.question) {
      await $fetch(`/api/courses/${props.courseId}/speaking/questions/${props.question.id}`, { method: 'PATCH', body })
    } else {
      await $fetch(`/api/courses/${props.courseId}/speaking/questions`, { method: 'POST', body })
    }
    toast.add({ title: t('speakingStudio.questionSaved'), color: 'success' })
    open.value = false
    emit('saved')
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="question ? t('speakingStudio.editQuestion') : t('speakingStudio.addQuestion')"
    :ui="{ content: 'sm:max-w-xl' }"
  >
    <template #body>
      <UForm
        :state="form"
        class="flex flex-col gap-4"
        @submit="save"
      >
        <UFormField
          :label="t('speakingStudio.fieldTitle')"
          required
        >
          <UInput
            v-model="form.title"
            :placeholder="t('speakingStudio.fieldTitlePlaceholder')"
            class="w-full"
          />
        </UFormField>

        <UPageGrid class="grid-cols-1 sm:grid-cols-2 gap-3">
          <UFormField :label="t('speakingStudio.fieldPart')">
            <UInput
              v-model="form.partLabel"
              :placeholder="t('speakingStudio.fieldPartPlaceholder')"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('speakingStudio.fieldSeconds')">
            <UInputNumber
              v-model="form.suggestedSeconds"
              :min="10"
              :max="600"
              :step="15"
              class="w-full"
            />
          </UFormField>
        </UPageGrid>

        <UFormField
          :label="t('speakingStudio.fieldPrompt')"
          required
        >
          <UTextarea
            v-model="form.prompt"
            :rows="4"
            :placeholder="t('speakingStudio.fieldPromptPlaceholder')"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('speakingStudio.fieldTips')">
          <UTextarea
            v-model="form.tips"
            :rows="2"
            :placeholder="t('speakingStudio.fieldTipsPlaceholder')"
            class="w-full"
          />
        </UFormField>

        <UPageList class="flex-row items-center justify-end gap-2">
          <UButton
            :label="t('common.cancel')"
            color="neutral"
            variant="ghost"
            @click="open = false"
          />
          <UButton
            type="submit"
            :label="t('common.save')"
            icon="i-lucide-check"
            :loading="saving"
            :disabled="!form.title.trim() || !form.prompt.trim()"
          />
        </UPageList>
      </UForm>
    </template>
  </UModal>
</template>
