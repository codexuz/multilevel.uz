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
  teacherCount?: number
  teacherAvgOverall?: number | null
  peerCount?: number
  peerAvgOverall?: number | null
}

const props = defineProps<{
  recordingId: string | null
  speakerName?: string
  isTeacher?: boolean
  initial?: SpeakingAssessmentValues | null
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [{ recordingId: string, assessmentSummary: SpeakingAssessmentSummary, myAssessment: SpeakingAssessmentValues }] }>()

const { t } = useI18n()
const toast = useToast()

const BANDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const

const form = reactive<SpeakingAssessmentValues>({
  overall: 6,
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
      overall: 6,
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
    const body = props.isTeacher
      ? form
      : { overall: form.overall }
    const res = await $fetch<{ assessmentSummary: SpeakingAssessmentSummary, myAssessment: SpeakingAssessmentValues }>(
      `/api/speaking-recordings/${props.recordingId}/assess`,
      { method: 'POST', body }
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
    :title="speakerName ? `${isTeacher ? t('speakingStudio.assessModalTitle') : t('speakingStudio.peerRateTitle')} · ${speakerName}` : (isTeacher ? t('speakingStudio.assessModalTitle') : t('speakingStudio.peerRateTitle'))"
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <template #body>
      <UPageList class="gap-4">
        <UAlert
          v-if="!isTeacher"
          icon="i-lucide-info"
          color="neutral"
          variant="soft"
          :description="t('speakingStudio.peerRateHint')"
        />

        <UFormField
          :label="`${t('speakingStudio.critOverall')} (0–9)`"
          required
        >
          <div class="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
            <UButton
              v-for="n in BANDS"
              :key="n"
              :label="String(n)"
              :color="form.overall === n ? 'primary' : 'neutral'"
              :variant="form.overall === n ? 'solid' : 'outline'"
              size="sm"
              class="justify-center tabular-nums"
              :data-testid="`rate-overall-${n}`"
              @click="form.overall = n"
            />
          </div>
        </UFormField>

        <template v-if="isTeacher">
          <USeparator :label="`${t('speakingStudio.optionalCriteria')} (0–9)`" />

          <UFormField
            v-for="c in criteria"
            :key="c.key"
            :label="c.label"
          >
            <div class="grid grid-cols-5 sm:grid-cols-10 gap-1">
              <UButton
                v-for="n in BANDS"
                :key="n"
                :label="String(n)"
                :color="form[c.key] === n ? 'primary' : 'neutral'"
                :variant="form[c.key] === n ? 'solid' : 'outline'"
                size="xs"
                class="justify-center tabular-nums"
                @click="toggleCriterion(c.key, n)"
              />
            </div>
          </UFormField>
        </template>

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
            data-testid="save-rating"
            @click="submit"
          />
        </UPageList>
      </UPageList>
    </template>
  </UModal>
</template>
