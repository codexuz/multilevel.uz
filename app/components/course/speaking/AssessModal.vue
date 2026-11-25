<script setup lang="ts">
export interface SpeakingAssessmentValues {
  overall: number
  fluency: number | null
  vocabulary: number | null
  grammar: number | null
  pronunciation: number | null
}

export interface SpeakingAssessmentSummary {
  count: number
  avgOverall: number | null
  avgFluency: number | null
  avgVocabulary: number | null
  avgGrammar: number | null
  avgPronunciation: number | null
}

const props = defineProps<{
  recordingId: string | null
  speakerName?: string
  initial?: SpeakingAssessmentValues | null
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [{ recordingId: string, assessmentSummary: SpeakingAssessmentSummary, myAssessment: SpeakingAssessmentValues }] }>()

const { t } = useI18n()
const toast = useToast()

const form = reactive<SpeakingAssessmentValues>({
  overall: 4,
  fluency: null,
  vocabulary: null,
  grammar: null,
  pronunciation: null
})

watch([open, () => props.initial], ([isOpen, init]) => {
  if (!isOpen) return
  if (init) {
    Object.assign(form, {
      overall: init.overall,
      fluency: init.fluency,
      vocabulary: init.vocabulary,
      grammar: init.grammar,
      pronunciation: init.pronunciation
    })
  } else {
    Object.assign(form, {
      overall: 4,
      fluency: null,
      vocabulary: null,
      grammar: null,
      pronunciation: null
    })
  }
}, { immediate: true })

const criteria = computed(() => [
  { key: 'fluency' as const, label: t('speakingStudio.critFluency') },
  { key: 'vocabulary' as const, label: t('speakingStudio.critVocabulary') },
  { key: 'grammar' as const, label: t('speakingStudio.critGrammar') },
  { key: 'pronunciation' as const, label: t('speakingStudio.critPronunciation') }
])

const saving = ref(false)
async function submit() {
  if (!props.recordingId) return
  saving.value = true
  try {
    const res = await $fetch<{ assessmentSummary: SpeakingAssessmentSummary, myAssessment: SpeakingAssessmentValues }>(
      `/api/speaking-recordings/${props.recordingId}/assess`,
      { method: 'POST', body: form }
    )
    toast.add({ title: t('speakingStudio.assessSaved'), color: 'success' })
    open.value = false
    emit('saved', { recordingId: props.recordingId, ...res })
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

function toggleCriterion(key: 'fluency' | 'vocabulary' | 'grammar' | 'pronunciation', val: number) {
  form[key] = form[key] === val ? null : val
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="speakerName ? `${t('speakingStudio.assessModalTitle')} · ${speakerName}` : t('speakingStudio.assessModalTitle')"
    :ui="{ content: 'sm:max-w-md' }"
  >
    <template #body>
      <UPageList class="gap-4">
        <UFormField
          :label="t('speakingStudio.critOverall')"
          required
        >
          <UFieldGroup>
            <UButton
              v-for="n in 5"
              :key="n"
              :label="String(n)"
              icon="i-lucide-star"
              :color="form.overall >= n ? 'warning' : 'neutral'"
              :variant="form.overall >= n ? 'soft' : 'outline'"
              size="sm"
              @click="form.overall = n"
            />
          </UFieldGroup>
        </UFormField>

        <USeparator :label="t('speakingStudio.optionalCriteria')" />

        <UFormField
          v-for="c in criteria"
          :key="c.key"
          :label="c.label"
        >
          <UFieldGroup>
            <UButton
              v-for="n in 5"
              :key="n"
              :label="String(n)"
              :color="(form[c.key] ?? 0) >= n ? 'primary' : 'neutral'"
              :variant="(form[c.key] ?? 0) >= n ? 'soft' : 'outline'"
              size="xs"
              @click="toggleCriterion(c.key, n)"
            />
          </UFieldGroup>
        </UFormField>

        <UPageList class="flex-row items-center justify-end gap-2">
          <UButton
            :label="t('common.cancel')"
            color="neutral"
            variant="ghost"
            @click="open = false"
          />
          <UButton
            :label="t('common.save')"
            icon="i-lucide-check"
            :loading="saving"
            @click="submit"
          />
        </UPageList>
      </UPageList>
    </template>
  </UModal>
</template>
