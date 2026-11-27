<script setup lang="ts">
import type { SpeakingQuestionItem } from '~/components/course/speaking/QuestionModal.vue'
import type { SpeakingAssessmentSummary, SpeakingAssessmentValues } from '~/components/course/speaking/AssessModal.vue'
import type { SpeakingPostDto } from '~/components/course/speaking/PostCard.vue'

interface StudioOverview {
  course: { id: string, slug: string, title: string }
  teaches: boolean
  questions: SpeakingQuestionItem[]
  totalRecordings: number
  myRecordings: number
}

interface RecordingsPage {
  items: SpeakingPostDto[]
  total: number
  page: number
  limit: number
  pages: number
}

definePageMeta({ layout: 'course' })

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const { confirm } = useDialogs()

const slug = computed(() => String(route.params.slug))
const coursePath = computed(() => `/courses/${slug.value}`)

const { data: studio, error: studioError, refresh: refreshStudio } = await useFetch<StudioOverview>(
  () => `/api/courses/${slug.value}/speaking`
)

if (studioError.value?.statusCode === 403) {
  await navigateTo(coursePath.value)
} else if (studioError.value) {
  throw createError({ statusCode: 404, statusMessage: t('courses.notFound'), fatal: true })
}

useSeoMeta({
  title: () => (studio.value ? `${t('speakingStudio.title')} · ${studio.value.course.title}` : t('speakingStudio.title')),
  robots: 'noindex'
})

const page = ref(1)
const limit = 10
const selectedQuestionId = ref<string>('ALL')
const onlyMine = ref(false)
watch([selectedQuestionId, onlyMine], () => { page.value = 1 })

const feedQuery = computed(() => ({
  page: page.value,
  limit,
  questionId: selectedQuestionId.value === 'ALL' ? undefined : selectedQuestionId.value,
  mine: onlyMine.value ? '1' : undefined
}))

const { data: feed, status: feedStatus, refresh: refreshFeed } = await useFetch<RecordingsPage>(
  () => `/api/courses/${slug.value}/speaking/recordings`,
  { query: feedQuery }
)

const questionFilterItems = computed(() => [
  { label: t('speakingStudio.filterAllQuestions'), value: 'ALL' },
  ...(studio.value?.questions ?? []).map((q, idx) => ({
    label: `${idx + 1}. ${q.title} (${q.recordingsCount})`,
    value: q.id
  }))
])

const fmtTime = (sec: number | null | undefined) => {
  if (!sec || !Number.isFinite(sec)) return null
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

// Teacher question modal
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
  await refreshStudio()
}
async function removeQuestion(q: SpeakingQuestionItem) {
  if (!studio.value) return
  const ok = await confirm({
    title: t('speakingStudio.deleteQuestion'),
    description: t('speakingStudio.deleteQuestionConfirm'),
    confirmLabel: t('common.delete'),
    color: 'error'
  })
  if (!ok) return
  try {
    await $fetch(`/api/courses/${studio.value.course.id}/speaking/questions/${q.id}`, { method: 'DELETE' })
    toast.add({ title: t('speakingStudio.questionDeleted'), color: 'success' })
    if (selectedQuestionId.value === q.id) selectedQuestionId.value = 'ALL'
    await Promise.all([refreshStudio(), refreshFeed()])
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  }
}

// Recorder modal
const recorderOpen = ref(false)
const recordingQuestion = ref<SpeakingQuestionItem | null>(null)
function openRecorder(q: SpeakingQuestionItem) {
  recordingQuestion.value = q
  recorderOpen.value = true
}
async function onPublished() {
  page.value = 1
  await Promise.all([refreshStudio(), refreshFeed()])
}

// 0-9 Assess / Rate modal
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
  await Promise.all([refreshStudio(), refreshFeed()])
}
</script>

<template>
  <AppPage
    :title="studio ? `${t('speakingStudio.title')} · ${studio.course.title}` : t('speakingStudio.title')"
    :back="coursePath"
    icon="i-lucide-mic"
    wide
  >
    <template #actions>
      <UButton
        v-if="studio?.teaches"
        :label="t('speakingStudio.addQuestion')"
        icon="i-lucide-plus"
        size="sm"
        @click="openAddQuestion"
      />
    </template>

    <UContainer
      v-if="studio"
      class="max-w-4xl px-0 flex flex-col gap-6"
    >
      <!-- Prompts -->
      <div
        v-if="studio.questions.length"
        class="grid gap-3"
      >
        <UCard
          v-for="(q, idx) in studio.questions"
          :key="q.id"
          variant="outline"
          :ui="{ header: 'flex flex-wrap items-center justify-between gap-2', body: 'flex flex-col gap-2.5' }"
        >
          <template #header>
            <UUser
              :name="`${idx + 1}. ${q.title}`"
              :description="q.partLabel || undefined"
              :avatar="{ icon: 'i-lucide-mic', ui: { root: 'bg-primary/10', icon: 'text-primary' } }"
              size="sm"
            />
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
                v-if="studio.teaches"
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                square
                @click="openEditQuestion(q)"
              />
              <UButton
                v-if="studio.teaches"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                square
                @click="removeQuestion(q)"
              />
            </div>
          </template>
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
          <div class="flex items-center justify-between gap-2 pt-1">
            <span class="text-xs text-muted">{{ t('speakingStudio.recordingsCount', { n: q.recordingsCount }) }}</span>
            <UButton
              icon="i-lucide-mic"
              :label="q.myRecordingsCount ? t('speakingStudio.recordAnother') : t('speakingStudio.recordAnswer')"
              size="sm"
              @click="openRecorder(q)"
            />
          </div>
        </UCard>
      </div>

      <!-- Feed (FB/IG style cards opening dedicated detail page) -->
      <div class="flex flex-wrap items-center justify-between gap-2">
        <USelect
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
        <USkeleton class="h-40 rounded-xl" />
      </div>

      <div
        v-else-if="feed?.items?.length"
        class="flex flex-col gap-4"
      >
        <CourseSpeakingPostCard
          v-for="rec in feed.items"
          :key="rec.id"
          :rec="rec"
          :course-slug="slug"
          :back-to="route.fullPath"
          show-question-title
          @assess="openAssess"
          @updated="onPostUpdated"
          @deleted="onPostDeleted"
        />

        <div
          v-if="feed.pages > 1"
          class="flex justify-center"
        >
          <UPagination
            v-model:page="page"
            :total="feed.total"
            :items-per-page="feed.limit"
          />
        </div>
      </div>

      <UCard v-else>
        <UEmpty
          icon="i-lucide-audio-lines"
          :title="t('speakingStudio.noRecordingsTitle')"
          :description="t('speakingStudio.noRecordingsHint')"
          variant="naked"
        />
      </UCard>
    </UContainer>

    <CourseSpeakingQuestionModal
      v-if="studio"
      v-model:open="questionModalOpen"
      :course-id="studio.course.id"
      :question="editingQuestion"
      @saved="onQuestionSaved"
    />

    <CourseSpeakingRecorderModal
      v-if="studio"
      v-model:open="recorderOpen"
      :course-id="studio.course.id"
      :question="recordingQuestion"
      @published="onPublished"
    />

    <CourseSpeakingAssessModal
      v-model:open="assessOpen"
      :recording-id="assessingRec?.id ?? null"
      :speaker-name="assessingRec?.author.name"
      :is-teacher="studio?.teaches"
      :initial="assessingRec?.myAssessment ?? null"
      @saved="onAssessmentSaved"
    />
  </AppPage>
</template>
