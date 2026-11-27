<script setup lang="ts">
import type { SpeakingQuestionItem } from '../speaking/QuestionModal.vue'

interface StudioOverview {
  course: { id: string, slug: string, title: string }
  teaches: boolean
  questions: SpeakingQuestionItem[]
  totalRecordings: number
  myRecordings: number
}

const props = defineProps<{
  courseId: string
  courseSlug: string
  exerciseId?: string | null
  lessonId?: string | null
}>()
const emit = defineEmits<{ changed: [] }>()

const { t } = useI18n()
const toast = useToast()
const { confirm } = useDialogs()

const { data, status, refresh } = await useFetch<StudioOverview>(
  () => `/api/courses/${props.courseId}/speaking`,
  { query: computed(() => (props.exerciseId ? { exerciseId: props.exerciseId } : {})) }
)

const modalOpen = ref(false)
const editing = ref<SpeakingQuestionItem | null>(null)

function openCreate() {
  editing.value = null
  modalOpen.value = true
}

function openEdit(q: SpeakingQuestionItem) {
  editing.value = q
  modalOpen.value = true
}

async function onSaved() {
  await refresh()
  emit('changed')
}

async function removeQuestion(q: SpeakingQuestionItem) {
  const ok = await confirm({
    title: t('speakingStudio.deleteQuestion'),
    description: t('speakingStudio.deleteQuestionConfirm'),
    confirmLabel: t('common.delete'),
    color: 'error'
  })
  if (!ok) return
  try {
    await $fetch(`/api/courses/${props.courseId}/speaking/questions/${q.id}`, { method: 'DELETE' })
    toast.add({ title: t('speakingStudio.questionDeleted'), color: 'success' })
    await refresh()
    emit('changed')
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  }
}

const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
</script>

<template>
  <UPageList class="gap-4">
    <UPageHeader
      :title="t('speakingStudio.title')"
      :description="t('speakingStudio.widgetBuilderHint')"
      :ui="{ root: 'border-0 py-0', title: 'text-base sm:text-lg', description: 'text-sm mt-1' }"
    >
      <template #links>
        <UButton
          v-if="lessonId"
          :to="`/courses/${courseSlug}/${lessonId}`"
          target="_blank"
          :label="t('builder.preview')"
          icon="i-lucide-external-link"
          color="neutral"
          variant="outline"
          size="sm"
        />
        <UButton
          :label="t('speakingStudio.addQuestion')"
          icon="i-lucide-plus"
          size="sm"
          @click="openCreate"
        />
      </template>
    </UPageHeader>

    <USkeleton
      v-if="status === 'pending' && !data"
      class="h-40 w-full rounded-xl"
    />

    <UPageList
      v-else-if="data?.questions.length"
      class="gap-3"
    >
      <UCard
        v-for="(q, idx) in data.questions"
        :key="q.id"
        variant="outline"
        :ui="{
          header: 'flex flex-wrap items-center justify-between gap-2',
          body: 'flex flex-col gap-2.5'
        }"
      >
        <template #header>
          <UUser
            :name="`${idx + 1}. ${q.title}`"
            :description="q.partLabel || undefined"
            :avatar="{ icon: 'i-lucide-mic', ui: { root: 'bg-primary/10', icon: 'text-primary' } }"
            size="sm"
          />
          <UPageList class="flex-row flex-wrap items-center gap-1.5">
            <UBadge
              v-if="q.suggestedSeconds"
              icon="i-lucide-timer"
              :label="t('speakingStudio.suggestedTime', { time: fmtTime(q.suggestedSeconds) })"
              color="info"
              variant="subtle"
              size="sm"
            />
            <UBadge
              icon="i-lucide-audio-lines"
              :label="t('speakingStudio.recordingsCount', { n: q.recordingsCount })"
              color="neutral"
              variant="subtle"
              size="sm"
            />
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="xs"
              square
              :aria-label="t('speakingStudio.editQuestion')"
              @click="openEdit(q)"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="xs"
              square
              :aria-label="t('speakingStudio.deleteQuestion')"
              @click="removeQuestion(q)"
            />
          </UPageList>
        </template>

        <UPageHeader
          :description="q.prompt"
          :ui="{ root: 'border-0 py-0', description: 'text-sm text-toned whitespace-pre-line mt-0' }"
        />

        <UAlert
          v-if="q.tips"
          color="neutral"
          variant="soft"
          icon="i-lucide-lightbulb"
          :description="q.tips"
        />
      </UCard>
    </UPageList>

    <UCard v-else>
      <UEmpty
        icon="i-lucide-mic"
        :title="t('speakingStudio.noQuestionsTitle')"
        :description="t('speakingStudio.noQuestionsTeacher')"
        :actions="[{ label: t('speakingStudio.addQuestion'), icon: 'i-lucide-plus', color: 'primary', onClick: openCreate }]"
      />
    </UCard>

    <CourseSpeakingQuestionModal
      v-model:open="modalOpen"
      :course-id="courseId"
      :exercise-id="exerciseId"
      :lesson-id="lessonId"
      :question="editing"
      @saved="onSaved"
    />
  </UPageList>
</template>
