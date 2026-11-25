<script setup lang="ts">
import type { BreadcrumbItem } from '@nuxt/ui'
import type { SpeakingQuestionItem } from '~/components/course/speaking/QuestionModal.vue'
import type { SpeakingAssessmentSummary, SpeakingAssessmentValues } from '~/components/course/speaking/AssessModal.vue'

interface SpeakingCommentDto {
  id: string
  body: string
  createdAt: string
  author: { id: string, name: string, avatarUrl: string | null, isTeacher: boolean }
  canDelete: boolean
}

interface SpeakingRecordingDto {
  id: string
  questionId: string
  questionTitle: string
  questionPrompt: string
  questionPartLabel: string | null
  audioUrl: string
  durationSeconds: number | null
  note: string | null
  createdAt: string
  author: { id: string, name: string, avatarUrl: string | null, isTeacher: boolean }
  isMine: boolean
  canAssess: boolean
  canDelete: boolean
  assessmentSummary: SpeakingAssessmentSummary
  myAssessment: SpeakingAssessmentValues | null
  commentsCount: number
  comments: SpeakingCommentDto[]
}

interface StudioOverview {
  course: { id: string, slug: string, title: string }
  teaches: boolean
  questions: SpeakingQuestionItem[]
  totalRecordings: number
  myRecordings: number
}

interface RecordingsPage {
  items: SpeakingRecordingDto[]
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

const { data: studio, status: studioStatus, error: studioError, refresh: refreshStudio } = await useFetch<StudioOverview>(
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

const breadcrumbs = computed<BreadcrumbItem[]>(() => {
  if (!studio.value) return []
  return [
    { label: studio.value.course.title, icon: 'i-lucide-graduation-cap', to: coursePath.value },
    { label: t('speakingStudio.title'), icon: 'i-lucide-mic' }
  ]
})

// ---- Paginated Recordings Feed State ----
const page = ref(1)
const limit = 10
const selectedQuestionId = ref<string>('ALL')
const onlyMine = ref(false)

watch([selectedQuestionId, onlyMine], () => {
  page.value = 1
})

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

const pageRange = computed(() => {
  const total = feed.value?.total ?? 0
  if (!total) return null
  const from = (page.value - 1) * limit + 1
  const to = Math.min(total, page.value * limit)
  return { from, to, total }
})

const fmtTime = (sec: number | null | undefined) => {
  if (!sec || !Number.isFinite(sec)) return null
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

// ---- Teacher Question Modal ----
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
  await Promise.all([refreshStudio(), refreshNuxtData(`course-outline-${slug.value}`)])
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
    await Promise.all([refreshStudio(), refreshFeed(), refreshNuxtData(`course-outline-${slug.value}`)])
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  }
}

// ---- Student Voice Recorder Modal ----
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

async function removeRecording(rec: SpeakingRecordingDto) {
  const ok = await confirm({
    title: t('common.delete'),
    description: t('speakingStudio.deleteRecordingConfirm'),
    confirmLabel: t('common.delete'),
    color: 'error'
  })
  if (!ok) return
  try {
    await $fetch(`/api/speaking-recordings/${rec.id}`, { method: 'DELETE' })
    toast.add({ title: t('speakingStudio.recordingDeleted'), color: 'success' })
    await Promise.all([refreshStudio(), refreshFeed()])
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  }
}

// ---- Peer & Teacher Assessment Modal ----
const assessOpen = ref(false)
const assessingRec = ref<SpeakingRecordingDto | null>(null)

function openAssess(rec: SpeakingRecordingDto) {
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

// ---- Comments ----
const commentDrafts = reactive<Record<string, string>>({})
const commentBusy = reactive<Record<string, boolean>>({})

async function postComment(rec: SpeakingRecordingDto) {
  const body = (commentDrafts[rec.id] ?? '').trim()
  if (!body || commentBusy[rec.id]) return
  commentBusy[rec.id] = true
  try {
    const created = await $fetch<SpeakingCommentDto>(`/api/speaking-recordings/${rec.id}/comments`, {
      method: 'POST',
      body: { body }
    })
    rec.comments.push(created)
    rec.commentsCount = rec.comments.length
    commentDrafts[rec.id] = ''
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    commentBusy[rec.id] = false
  }
}

async function removeComment(rec: SpeakingRecordingDto, comment: SpeakingCommentDto) {
  const ok = await confirm({
    title: t('common.delete'),
    description: t('speakingStudio.deleteCommentConfirm'),
    confirmLabel: t('common.delete'),
    color: 'error'
  })
  if (!ok) return
  try {
    await $fetch(`/api/speaking-comments/${comment.id}`, { method: 'DELETE' })
    rec.comments = rec.comments.filter(c => c.id !== comment.id)
    rec.commentsCount = rec.comments.length
    toast.add({ title: t('speakingStudio.commentDeleted'), color: 'success' })
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  }
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

    <UContainer class="max-w-4xl px-0 flex flex-col gap-6">
      <USkeleton
        v-if="studioStatus === 'pending' && !studio"
        class="h-48 w-full rounded-2xl"
      />

      <template v-else-if="studio">
        <UBreadcrumb :items="breadcrumbs" />

        <UPageHeader
          :title="t('speakingStudio.title')"
          :description="t('speakingStudio.subtitle')"
          :ui="{ root: 'border-0 py-0', title: 'text-2xl sm:text-3xl', description: 'text-sm mt-1.5' }"
        />

        <!-- Summary Stats -->
        <UPageGrid class="grid-cols-1 sm:grid-cols-3 gap-3">
          <StatTile
            :label="t('speakingStudio.statQuestions')"
            :value="studio.questions.length"
            icon="i-lucide-message-square-quote"
            color="primary"
          />
          <StatTile
            :label="t('speakingStudio.statRecordings')"
            :value="studio.totalRecordings"
            icon="i-lucide-audio-lines"
            color="info"
          />
          <StatTile
            :label="t('speakingStudio.statMine')"
            :value="studio.myRecordings"
            icon="i-lucide-mic"
            color="success"
          />
        </UPageGrid>

        <!-- Speaking Questions Section -->
        <UPageHeader
          :title="`${t('speakingStudio.questionsTitle')} (${studio.questions.length})`"
          :ui="{ root: 'border-0 py-0', title: 'text-lg sm:text-xl' }"
        >
          <template
            v-if="studio.teaches"
            #links
          >
            <UButton
              :label="t('speakingStudio.addQuestion')"
              icon="i-lucide-plus"
              size="sm"
              @click="openAddQuestion"
            />
          </template>
        </UPageHeader>

        <UPageList
          v-if="studio.questions.length"
          class="gap-4"
        >
          <UCard
            v-for="(q, idx) in studio.questions"
            :key="q.id"
            variant="outline"
            :ui="{
              header: 'flex flex-wrap items-start justify-between gap-2',
              body: 'flex flex-col gap-3',
              footer: 'flex flex-wrap items-center justify-between gap-2'
            }"
          >
            <template #header>
              <UUser
                :name="`${idx + 1}. ${q.title}`"
                :description="q.partLabel || undefined"
                :avatar="{
                  icon: q.myRecordingsCount > 0 ? 'i-lucide-circle-check' : 'i-lucide-mic',
                  ui: q.myRecordingsCount > 0
                    ? { root: 'bg-success/15', icon: 'text-success' }
                    : { root: 'bg-primary/10', icon: 'text-primary' }
                }"
                size="md"
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
                <UBadge
                  v-if="q.myRecordingsCount > 0"
                  icon="i-lucide-check"
                  :label="t('speakingStudio.myDoneBadge', { n: q.myRecordingsCount })"
                  color="success"
                  variant="soft"
                  size="sm"
                />
                <template v-if="studio.teaches">
                  <UButton
                    icon="i-lucide-pencil"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    square
                    :aria-label="t('speakingStudio.editQuestion')"
                    @click="openEditQuestion(q)"
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
                </template>
              </UPageList>
            </template>

            <UPageHeader
              :description="q.prompt"
              :ui="{ root: 'border-0 py-0', description: 'text-sm sm:text-base text-highlighted whitespace-pre-line mt-0' }"
            />

            <UAlert
              v-if="q.tips"
              color="neutral"
              variant="soft"
              icon="i-lucide-lightbulb"
              :description="q.tips"
            />

            <template #footer>
              <UButton
                v-if="q.recordingsCount > 0"
                :label="t('speakingStudio.recordingsCount', { n: q.recordingsCount })"
                icon="i-lucide-filter"
                :color="selectedQuestionId === q.id ? 'primary' : 'neutral'"
                :variant="selectedQuestionId === q.id ? 'soft' : 'outline'"
                size="sm"
                @click="selectedQuestionId = selectedQuestionId === q.id ? 'ALL' : q.id"
              />
              <UButton
                :label="t('speakingStudio.recordAnswer')"
                icon="i-lucide-mic"
                color="primary"
                size="sm"
                class="ms-auto"
                @click="openRecorder(q)"
              />
            </template>
          </UCard>
        </UPageList>

        <UCard v-else>
          <UEmpty
            icon="i-lucide-mic"
            :title="t('speakingStudio.noQuestionsTitle')"
            :description="studio.teaches ? t('speakingStudio.noQuestionsTeacher') : t('speakingStudio.noQuestionsStudent')"
            :actions="studio.teaches ? [{ label: t('speakingStudio.addQuestion'), icon: 'i-lucide-plus', color: 'primary', onClick: openAddQuestion }] : undefined"
          />
        </UCard>

        <!-- Paginated Recorded Answers Section -->
        <USeparator />

        <UPageHeader
          :title="`${t('speakingStudio.answersTitle')} (${feed?.total ?? 0})`"
          :description="pageRange ? t('speakingStudio.pageSummary', pageRange) : undefined"
          :ui="{ root: 'border-0 py-0', title: 'text-lg sm:text-xl', description: 'text-xs mt-1' }"
        />

        <!-- Filter Controls -->
        <UPageList class="flex-row flex-wrap items-center justify-between gap-3">
          <USelect
            v-if="studio.questions.length > 0"
            v-model="selectedQuestionId"
            :items="questionFilterItems"
            value-key="value"
            class="w-full sm:w-72"
          />
          <UFieldGroup>
            <UButton
              :label="t('speakingStudio.filterAllAnswers')"
              :color="!onlyMine ? 'primary' : 'neutral'"
              :variant="!onlyMine ? 'solid' : 'outline'"
              size="sm"
              @click="onlyMine = false"
            />
            <UButton
              :label="t('speakingStudio.filterMyAnswers')"
              :color="onlyMine ? 'primary' : 'neutral'"
              :variant="onlyMine ? 'solid' : 'outline'"
              size="sm"
              @click="onlyMine = true"
            />
          </UFieldGroup>
        </UPageList>

        <!-- Feed Loading Skeleton -->
        <UPageList
          v-if="feedStatus === 'pending' && !feed"
          class="gap-4"
        >
          <USkeleton
            v-for="n in 3"
            :key="n"
            class="h-44 w-full rounded-xl"
          />
        </UPageList>

        <!-- Recordings Cards -->
        <UPageList
          v-else-if="feed?.items.length"
          class="gap-4"
        >
          <UCard
            v-for="rec in feed.items"
            :key="rec.id"
            variant="outline"
            :ui="{
              header: 'flex flex-wrap items-start justify-between gap-2',
              body: 'flex flex-col gap-3.5'
            }"
          >
            <template #header>
              <UUser
                :name="rec.author.name"
                :description="relativeTime(rec.createdAt)"
                :avatar="{ src: rec.author.avatarUrl ?? undefined, alt: rec.author.name }"
                size="md"
              />
              <UPageList class="flex-row flex-wrap items-center gap-1.5">
                <UBadge
                  v-if="rec.author.isTeacher"
                  :label="t('speakingStudio.teacherBadge')"
                  icon="i-lucide-graduation-cap"
                  color="primary"
                  variant="soft"
                  size="xs"
                />
                <UBadge
                  v-else-if="rec.isMine"
                  :label="t('speakingStudio.youBadge')"
                  color="success"
                  variant="subtle"
                  size="xs"
                />
                <UBadge
                  v-if="rec.questionPartLabel"
                  :label="rec.questionPartLabel"
                  color="neutral"
                  variant="outline"
                  size="xs"
                />
                <UBadge
                  :label="rec.questionTitle"
                  icon="i-lucide-message-square-quote"
                  color="neutral"
                  variant="subtle"
                  size="xs"
                />
                <UBadge
                  v-if="fmtTime(rec.durationSeconds)"
                  :label="fmtTime(rec.durationSeconds)!"
                  icon="i-lucide-clock"
                  color="info"
                  variant="subtle"
                  size="xs"
                />
                <UButton
                  v-if="rec.canDelete"
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="xs"
                  square
                  :aria-label="t('common.delete')"
                  @click="removeRecording(rec)"
                />
              </UPageList>
            </template>

            <!-- Waveform Audio Player -->
            <MediaWaveAudio
              :src="rec.audioUrl"
              :title="rec.questionTitle"
            />

            <!-- Optional Speaker Note -->
            <UAlert
              v-if="rec.note"
              color="neutral"
              variant="soft"
              icon="i-lucide-sticky-note"
              :description="rec.note"
            />

            <!-- Peer & Teacher Assessment Summary Bar -->
            <UPageList class="flex-row flex-wrap items-center justify-between gap-2">
              <UPageList class="flex-row flex-wrap items-center gap-1.5">
                <UBadge
                  v-if="rec.assessmentSummary.avgOverall !== null"
                  icon="i-lucide-star"
                  :label="`${rec.assessmentSummary.avgOverall} / 5 · ${t('speakingStudio.reviewsCount', { n: rec.assessmentSummary.count })}`"
                  color="warning"
                  variant="soft"
                  size="md"
                />
                <UBadge
                  v-else
                  icon="i-lucide-star"
                  :label="t('speakingStudio.noReviewsYet')"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                />
                <UBadge
                  v-if="rec.assessmentSummary.avgFluency !== null"
                  :label="`${t('speakingStudio.critFluency')}: ${rec.assessmentSummary.avgFluency}`"
                  color="neutral"
                  variant="outline"
                  size="xs"
                />
                <UBadge
                  v-if="rec.assessmentSummary.avgVocabulary !== null"
                  :label="`${t('speakingStudio.critVocabulary')}: ${rec.assessmentSummary.avgVocabulary}`"
                  color="neutral"
                  variant="outline"
                  size="xs"
                />
                <UBadge
                  v-if="rec.assessmentSummary.avgGrammar !== null"
                  :label="`${t('speakingStudio.critGrammar')}: ${rec.assessmentSummary.avgGrammar}`"
                  color="neutral"
                  variant="outline"
                  size="xs"
                />
                <UBadge
                  v-if="rec.assessmentSummary.avgPronunciation !== null"
                  :label="`${t('speakingStudio.critPronunciation')}: ${rec.assessmentSummary.avgPronunciation}`"
                  color="neutral"
                  variant="outline"
                  size="xs"
                />
              </UPageList>

              <UButton
                v-if="rec.canAssess"
                :label="rec.myAssessment ? t('speakingStudio.editAssessment') : t('speakingStudio.assess')"
                icon="i-lucide-star"
                :color="rec.myAssessment ? 'warning' : 'primary'"
                variant="soft"
                size="xs"
                @click="openAssess(rec)"
              />
            </UPageList>

            <USeparator />

            <!-- Comments Section -->
            <UPageList class="gap-2.5">
              <UBadge
                icon="i-lucide-message-circle"
                :label="t('speakingStudio.commentsTitle', { n: rec.commentsCount })"
                color="neutral"
                variant="subtle"
                size="sm"
                class="self-start"
              />

              <UPageList
                v-if="rec.comments.length"
                class="gap-2"
              >
                <UCard
                  v-for="cm in rec.comments"
                  :key="cm.id"
                  variant="soft"
                  :ui="{ body: 'p-3 flex flex-col gap-1.5' }"
                >
                  <UPageList class="flex-row items-center justify-between gap-2">
                    <UUser
                      :name="cm.author.name"
                      :description="relativeTime(cm.createdAt)"
                      :avatar="{ src: cm.author.avatarUrl ?? undefined, alt: cm.author.name }"
                      size="xs"
                    />
                    <UPageList class="flex-row items-center gap-1">
                      <UBadge
                        v-if="cm.author.isTeacher"
                        :label="t('speakingStudio.teacherBadge')"
                        color="primary"
                        variant="soft"
                        size="xs"
                      />
                      <UButton
                        v-if="cm.canDelete"
                        icon="i-lucide-trash-2"
                        color="error"
                        variant="ghost"
                        size="xs"
                        square
                        :aria-label="t('common.delete')"
                        @click="removeComment(rec, cm)"
                      />
                    </UPageList>
                  </UPageList>
                  <UPageHeader
                    :description="cm.body"
                    :ui="{ root: 'border-0 py-0', description: 'text-sm text-toned whitespace-pre-line mt-0' }"
                  />
                </UCard>
              </UPageList>

              <!-- Add Comment Input -->
              <UForm
                :state="commentDrafts"
                class="flex items-center gap-2"
                @submit="postComment(rec)"
              >
                <UInput
                  v-model="commentDrafts[rec.id]"
                  :placeholder="t('speakingStudio.commentPlaceholder')"
                  class="flex-1"
                  size="sm"
                />
                <UButton
                  type="submit"
                  :label="t('speakingStudio.postComment')"
                  icon="i-lucide-send"
                  size="sm"
                  :loading="commentBusy[rec.id]"
                  :disabled="!(commentDrafts[rec.id] ?? '').trim()"
                />
              </UForm>
            </UPageList>
          </UCard>
        </UPageList>

        <!-- Empty Recordings State -->
        <UCard v-else>
          <UEmpty
            icon="i-lucide-audio-lines"
            :title="t('speakingStudio.noRecordingsTitle')"
            :description="t('speakingStudio.noRecordingsText')"
            :actions="studio.questions.length ? [{ label: t('speakingStudio.recordAnswer'), icon: 'i-lucide-mic', color: 'primary', onClick: () => openRecorder(studio!.questions[0]!) }] : undefined"
          />
        </UCard>

        <!-- Pagination -->
        <UPageList
          v-if="(feed?.pages ?? 1) > 1"
          class="items-center"
        >
          <UPagination
            v-model:page="page"
            :total="feed?.total ?? 0"
            :items-per-page="limit"
          />
        </UPageList>

        <!-- Modals -->
        <CourseSpeakingQuestionModal
          v-if="studio.teaches"
          v-model:open="questionModalOpen"
          :course-id="studio.course.id"
          :question="editingQuestion"
          @saved="onQuestionSaved"
        />

        <CourseSpeakingRecorderModal
          v-model:open="recorderOpen"
          :course-id="studio.course.id"
          :question="recordingQuestion"
          @published="onPublished"
        />

        <CourseSpeakingAssessModal
          v-model:open="assessOpen"
          :recording-id="assessingRec?.id ?? null"
          :speaker-name="assessingRec?.author.name"
          :initial="assessingRec?.myAssessment ?? null"
          @saved="onAssessmentSaved"
        />
      </template>
    </UContainer>
  </AppPage>
</template>
