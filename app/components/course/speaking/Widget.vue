<script setup lang="ts">
import type { SpeakingQuestionItem } from './QuestionModal.vue'
import type { SpeakingAssessmentSummary, SpeakingAssessmentValues } from './AssessModal.vue'
import type { SpeakingPostDto } from './PostCard.vue'

interface SpeakingExerciseSummary {
  id: string
  title: string
  instructions: string | null
  requiredForCompletion: boolean
  passed: boolean
  speakingQuestions?: SpeakingQuestionItem[]
}

interface RecordingsPage {
  items: SpeakingPostDto[]
  total: number
  page: number
  limit: number
  pages: number
}

const props = defineProps<{
  courseId: string
  courseSlug: string
  lessonId: string
  exercise: SpeakingExerciseSummary
  teaches: boolean
}>()

const emit = defineEmits<{ changed: [] }>()

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const { confirm } = useDialogs()

// Questions scoped to this speaking exercise (refreshable if teacher adds/edits inline)
const { data: overview, refresh: refreshOverview } = await useFetch<{ questions: SpeakingQuestionItem[] }>(
  () => `/api/courses/${props.courseId}/speaking`,
  {
    query: computed(() => ({ exerciseId: props.exercise.id })),
    default: () => ({ questions: props.exercise.speakingQuestions ?? [] })
  }
)

const questions = computed(() => overview.value?.questions ?? props.exercise.speakingQuestions ?? [])

// Paginated responses feed for this lesson's speaking widget
const page = ref(1)
const limit = 6
const selectedQuestionId = ref('ALL')
const onlyMine = ref(false)
watch([selectedQuestionId, onlyMine], () => { page.value = 1 })

const feedQuery = computed(() => ({
  exerciseId: props.exercise.id,
  questionId: selectedQuestionId.value === 'ALL' ? undefined : selectedQuestionId.value,
  mine: onlyMine.value ? '1' : undefined,
  page: page.value,
  limit
}))

const { data: feed, status: feedStatus, refresh: refreshFeed } = await useFetch<RecordingsPage>(
  () => `/api/courses/${props.courseId}/speaking/recordings`,
  { query: feedQuery }
)

const questionFilterItems = computed(() => [
  { label: t('speakingStudio.filterAllQuestions'), value: 'ALL' },
  ...questions.value.map((q, idx) => ({
    label: `${idx + 1}. ${q.title} (${q.recordingsCount})`,
    value: q.id
  }))
])

const fmtTime = (sec: number | null | undefined) => {
  if (!sec || !Number.isFinite(sec)) return null
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

// ---- Teacher inline question management ----
const questionModalOpen = ref(false)
const editingQuestion = ref<SpeakingQuestionItem | null>(null)
function openAddQuestion() {
  editingQuestion.value = null
  questionModalOpen.value = true
}
function openEditQuestion(q: SpeakingQuestionItem) {
  editingQuestion.value = q
  questionModalOpen.value = true
}
async function onQuestionSaved() {
  await refreshOverview()
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
    if (selectedQuestionId.value === q.id) selectedQuestionId.value = 'ALL'
    await Promise.all([refreshOverview(), refreshFeed()])
    emit('changed')
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  }
}

// ---- Student voice recorder ----
const recorderOpen = ref(false)
const recordingQuestion = ref<SpeakingQuestionItem | null>(null)
function openRecorder(q: SpeakingQuestionItem) {
  recordingQuestion.value = q
  recorderOpen.value = true
}
async function onPublished() {
  page.value = 1
  await Promise.all([refreshOverview(), refreshFeed()])
  emit('changed')
}

// ---- 0-9 Peer Rating / Teacher Assessment ----
const assessOpen = ref(false)
const assessingRec = ref<SpeakingPostDto | null>(null)
function openAssess(rec: SpeakingPostDto) {
  assessingRec.value = rec
  assessOpen.value = true
}
function onAssessmentSaved(payload: { recordingId: string, assessmentSummary: SpeakingAssessmentSummary, myAssessment: SpeakingAssessmentValues }) {
  const target = feed.value?.items.find(i => i.id === payload.recordingId)
  if (target) {
    target.assessmentSummary = payload.assessmentSummary
    target.myAssessment = payload.myAssessment
  }
}
function onPostUpdated(patch: Partial<SpeakingPostDto> & { id: string }) {
  const target = feed.value?.items.find(i => i.id === patch.id)
  if (target) Object.assign(target, patch)
}
async function onPostDeleted() {
  await Promise.all([refreshOverview(), refreshFeed()])
  emit('changed')
}
</script>

<template>
  <UCard
    variant="outline"
    :ui="{
      header: 'flex flex-wrap items-start justify-between gap-3',
      body: 'flex flex-col gap-5'
    }"
    data-testid="lesson-speaking-widget"
  >
    <template #header>
      <div class="flex items-start gap-3 min-w-0">
        <UAvatar
          icon="i-lucide-mic"
          size="md"
          :ui="exercise.passed ? { root: 'bg-success/15', icon: 'text-success' } : { root: 'bg-primary/10', icon: 'text-primary' }"
        />
        <div class="min-w-0">
          <h3 class="text-base sm:text-lg font-semibold text-highlighted">
            {{ exercise.title }}
          </h3>
          <p
            v-if="exercise.instructions"
            class="text-sm text-muted mt-0.5 whitespace-pre-line"
          >
            {{ exercise.instructions }}
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-1.5">
        <UBadge
          v-if="exercise.requiredForCompletion"
          :label="t('builder.required')"
          color="warning"
          variant="soft"
          size="sm"
        />
        <UBadge
          v-if="exercise.passed"
          :label="t('speakingStudio.answeredBadge')"
          icon="i-lucide-circle-check"
          color="success"
          variant="soft"
          size="sm"
        />
        <UButton
          v-if="teaches"
          :label="t('speakingStudio.addQuestion')"
          icon="i-lucide-plus"
          size="xs"
          variant="soft"
          @click="openAddQuestion"
        />
      </div>
    </template>

    <!-- Speaking Prompts Related to the Lesson Article -->
    <div
      v-if="questions.length"
      class="flex flex-col gap-3"
    >
      <UCard
        v-for="(q, idx) in questions"
        :key="q.id"
        variant="subtle"
        :ui="{ body: 'flex flex-col gap-2.5 p-4 sm:p-4' }"
      >
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <UBadge
              :label="String(idx + 1)"
              color="primary"
              variant="soft"
              size="sm"
            />
            <p class="font-semibold text-highlighted text-sm sm:text-base">
              {{ q.title }}
            </p>
            <UBadge
              v-if="q.partLabel"
              :label="q.partLabel"
              color="neutral"
              variant="outline"
              size="xs"
            />
          </div>
          <div class="flex items-center gap-1.5">
            <UBadge
              v-if="fmtTime(q.suggestedSeconds)"
              icon="i-lucide-timer"
              :label="fmtTime(q.suggestedSeconds)!"
              color="info"
              variant="subtle"
              size="xs"
            />
            <UButton
              v-if="teaches"
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="xs"
              square
              :aria-label="t('speakingStudio.editQuestion')"
              @click="openEditQuestion(q)"
            />
            <UButton
              v-if="teaches"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="xs"
              square
              :aria-label="t('speakingStudio.deleteQuestion')"
              @click="removeQuestion(q)"
            />
          </div>
        </div>

        <p class="text-sm text-toned whitespace-pre-line">
          {{ q.prompt }}
        </p>

        <UAlert
          v-if="q.tips"
          icon="i-lucide-lightbulb"
          color="neutral"
          variant="soft"
          :description="q.tips"
        />

        <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span class="text-xs text-muted">
            {{ t('speakingStudio.recordingsCount', { n: q.recordingsCount }) }}
          </span>
          <UButton
            icon="i-lucide-mic"
            :label="q.myRecordingsCount ? t('speakingStudio.recordAnother') : t('speakingStudio.recordAnswer')"
            size="sm"
            data-testid="widget-record-btn"
            @click="openRecorder(q)"
          />
        </div>
      </UCard>
    </div>

    <UEmpty
      v-else
      icon="i-lucide-mic"
      :title="t('speakingStudio.noQuestionsTitle')"
      :description="teaches ? t('speakingStudio.noQuestionsTeacher') : t('speakingStudio.noQuestionsStudent')"
      variant="naked"
      :actions="teaches ? [{ label: t('speakingStudio.addQuestion'), icon: 'i-lucide-plus', onClick: openAddQuestion }] : undefined"
    />

    <!-- Embedded Responses Feed (Facebook/Instagram Post Style) -->
    <template v-if="questions.length">
      <USeparator :label="t('speakingStudio.responsesHeading', { n: feed?.total ?? 0 })" />

      <div class="flex flex-wrap items-center justify-between gap-2">
        <USelect
          v-if="questions.length > 1"
          v-model="selectedQuestionId"
          :items="questionFilterItems"
          class="w-full sm:w-64"
          size="sm"
        />
        <UCheckbox
          v-model="onlyMine"
          :label="t('speakingStudio.onlyMine')"
        />
      </div>

      <div
        v-if="feedStatus === 'pending' && !feed"
        class="grid gap-3"
      >
        <USkeleton class="h-36 rounded-xl" />
      </div>

      <div
        v-else-if="feed?.items?.length"
        class="flex flex-col gap-3"
      >
        <CourseSpeakingPostCard
          v-for="rec in feed.items"
          :key="rec.id"
          :rec="rec"
          :course-slug="courseSlug"
          :back-to="route.fullPath"
          :show-question-title="questions.length > 1"
          @assess="openAssess"
          @updated="onPostUpdated"
          @deleted="onPostDeleted"
        />

        <div
          v-if="feed.pages > 1"
          class="flex justify-center pt-1"
        >
          <UPagination
            v-model:page="page"
            :total="feed.total"
            :items-per-page="feed.limit"
          />
        </div>
      </div>

      <UEmpty
        v-else
        icon="i-lucide-audio-lines"
        :title="t('speakingStudio.noRecordingsTitle')"
        :description="t('speakingStudio.noRecordingsHint')"
        variant="naked"
      />
    </template>

    <CourseSpeakingQuestionModal
      v-model:open="questionModalOpen"
      :course-id="courseId"
      :exercise-id="exercise.id"
      :lesson-id="lessonId"
      :question="editingQuestion"
      @saved="onQuestionSaved"
    />

    <CourseSpeakingRecorderModal
      v-model:open="recorderOpen"
      :course-id="courseId"
      :question="recordingQuestion"
      @published="onPublished"
    />

    <CourseSpeakingAssessModal
      v-model:open="assessOpen"
      :recording-id="assessingRec?.id ?? null"
      :speaker-name="assessingRec?.author.name"
      :is-teacher="teaches"
      :initial="assessingRec?.myAssessment ?? null"
      @saved="onAssessmentSaved"
    />
  </UCard>
</template>
