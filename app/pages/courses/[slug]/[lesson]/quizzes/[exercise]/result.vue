<script setup lang="ts">
import type { BreadcrumbItem, TableColumn, TabsItem } from '@nuxt/ui'
import type { LmsExerciseDto, LmsQuestionDto, LmsQuestionGrade } from '#shared/utils/lms'

interface ExerciseAttemptDto {
  id: string
  score: number
  earnedPoints: number
  totalPoints: number
  passed: boolean
  durationSeconds: number | null
  reviewStatus: string | null
  answers: Record<string, unknown>
  results: Record<string, LmsQuestionGrade>
  submittedAt: string
}

interface ExercisePagePayload extends LmsExerciseDto {
  teaches: boolean
  course: { id: string, slug: string, title: string }
  lesson: { id: string, title: string, next: { id: string, title: string, locked: boolean } | null }
  siblings: Array<{ id: string, position: number, title: string, passed: boolean }>
  questions: LmsQuestionDto[]
  attempts: ExerciseAttemptDto[]
}

interface AttemptRow {
  id: string
  number: number
  submittedAt: string
  score: number
  earnedPoints: number
  totalPoints: number
  durationSeconds: number | null
  passed: boolean
  reviewStatus: string | null
}

definePageMeta({ layout: 'course' })

const { t } = useI18n()
const route = useRoute()

const slug = computed(() => String(route.params.slug))
const lessonId = computed(() => String(route.params.lesson))
const exerciseId = computed(() => String(route.params.exercise))

const lessonPath = computed(() => `/courses/${slug.value}/${lessonId.value}`)
const quizPath = computed(() => `${lessonPath.value}/quizzes/${exerciseId.value}`)

const { data: ex, status, error } = await useFetch<ExercisePagePayload>(() => `/api/course-exercises/${exerciseId.value}`)

if (error.value?.statusCode === 403) {
  const errData = (error.value as any)?.data?.data
  if (errData?.code === 'DRIP_LOCKED') {
    await navigateTo(lessonPath.value)
  } else {
    await navigateTo(`/courses/${slug.value}?enroll=${lessonId.value}`)
  }
} else if (error.value) {
  throw createError({ statusCode: 404, statusMessage: t('quiz.notFound'), fatal: true })
}

useSeoMeta({
  title: () => (ex.value ? `${ex.value.title} · ${t('quiz.resultsTitle')}` : t('quiz.resultsTitle')),
  robots: 'noindex'
})

const selectedAttemptId = ref<string | null>(typeof route.query.attempt === 'string' ? route.query.attempt : null)

watch(() => route.query.attempt, (q) => {
  if (typeof q === 'string' && q) selectedAttemptId.value = q
})

const activeAttempt = computed<ExerciseAttemptDto | null>(() => {
  const list = ex.value?.attempts ?? []
  if (!list.length) return null
  if (selectedAttemptId.value) {
    const found = list.find(a => a.id === selectedAttemptId.value)
    if (found) return found
  }
  return list[0]!
})

const activeAttemptNumber = computed(() => {
  const list = ex.value?.attempts ?? []
  if (!activeAttempt.value) return 0
  const idx = list.findIndex(a => a.id === activeAttempt.value!.id)
  return idx === -1 ? list.length : list.length - idx
})

const autoDone = computed(() => route.query.autoDone === '1')
const xpEarned = computed(() => {
  const n = Number(route.query.xp)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
})

const canRetry = computed(() => {
  if (!ex.value) return false
  if (ex.value.teaches) return true
  if (!ex.value.maxAttempts) return true
  return ex.value.attempts.length < ex.value.maxAttempts
})

const nextQuiz = computed(() => {
  const siblings = ex.value?.siblings ?? []
  const idx = siblings.findIndex(s => s.id === exerciseId.value)
  if (idx === -1 || idx >= siblings.length - 1) return null
  return siblings[idx + 1]!
})

const nextQuizPath = computed(() => (nextQuiz.value ? `${lessonPath.value}/quizzes/${nextQuiz.value.id}` : undefined))

const breadcrumbs = computed<BreadcrumbItem[]>(() => {
  if (!ex.value) return []
  return [
    { label: ex.value.course.title, icon: 'i-lucide-graduation-cap', to: `/courses/${slug.value}` },
    { label: ex.value.lesson.title, icon: 'i-lucide-book-open', to: lessonPath.value },
    { label: ex.value.title, icon: 'i-lucide-list-checks', to: quizPath.value },
    { label: t('quiz.resultsTitle'), icon: 'i-lucide-trophy' }
  ]
})

const gradedItems = computed(() => {
  if (!ex.value || !activeAttempt.value) return []
  return ex.value.questions.map((question, index) => ({
    question,
    index,
    answer: activeAttempt.value!.answers?.[question.id],
    grade: activeAttempt.value!.results?.[question.id] ?? null
  }))
})

const correctCount = computed(() => gradedItems.value.filter(i => i.grade?.isCorrect).length)
const incorrectCount = computed(() => gradedItems.value.filter(i => !i.grade?.isCorrect).length)

const activeTab = ref('review')
const reviewFilter = ref<'all' | 'incorrect' | 'correct'>('all')

const filteredItems = computed(() => {
  if (reviewFilter.value === 'incorrect') return gradedItems.value.filter(i => !i.grade?.isCorrect)
  if (reviewFilter.value === 'correct') return gradedItems.value.filter(i => i.grade?.isCorrect)
  return gradedItems.value
})

const tabItems = computed<TabsItem[]>(() => [
  { label: t('quiz.tabReview'), value: 'review', icon: 'i-lucide-list-checks', badge: ex.value?.questions.length ?? 0 },
  { label: t('quiz.tabHistory'), value: 'history', icon: 'i-lucide-history', badge: ex.value?.attempts.length ?? 0 }
])

const attemptRows = computed<AttemptRow[]>(() => {
  const list = ex.value?.attempts ?? []
  return list.map((a, idx) => ({
    id: a.id,
    number: list.length - idx,
    submittedAt: a.submittedAt,
    score: a.score,
    earnedPoints: a.earnedPoints,
    totalPoints: a.totalPoints,
    durationSeconds: a.durationSeconds,
    passed: a.passed,
    reviewStatus: a.reviewStatus
  }))
})

const attemptColumns = computed<TableColumn<AttemptRow>[]>(() => [
  { accessorKey: 'number', header: t('quiz.colAttempt') },
  { accessorKey: 'submittedAt', header: t('quiz.colDate') },
  { accessorKey: 'score', header: t('quiz.colScore') },
  { accessorKey: 'earnedPoints', header: t('quiz.colPoints') },
  { accessorKey: 'durationSeconds', header: t('quiz.colDuration') },
  { accessorKey: 'passed', header: t('quiz.colStatus') },
  { id: 'action', header: t('quiz.colAction') }
])

function fmtDuration(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? t('quiz.durationMinSec', { m, s: String(s).padStart(2, '0') }) : t('quiz.durationSec', { s })
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return localeDate(d, intlLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function selectAttempt(id: string) {
  selectedAttemptId.value = id
  reviewFilter.value = 'all'
  activeTab.value = 'review'
}
</script>

<template>
  <AppPage
    :title="ex ? `${ex.title} · ${t('quiz.resultsTitle')}` : t('quiz.resultsTitle')"
    :back="lessonPath"
    icon="i-lucide-trophy"
    wide
  >
    <template #actions>
      <UButton
        v-if="ex && canRetry"
        :to="quizPath"
        :label="ex.attempts.length ? t('quiz.retake') : t('quiz.start')"
        :icon="ex.attempts.length ? 'i-lucide-rotate-cw' : 'i-lucide-play'"
        size="sm"
      />
    </template>

    <UContainer class="max-w-4xl px-0 flex flex-col gap-5">
      <USkeleton
        v-if="status === 'pending' && !ex"
        class="h-48 w-full rounded-2xl"
      />

      <template v-else-if="ex">
        <UBreadcrumb :items="breadcrumbs" />

        <!-- Empty State: No Attempts Yet -->
        <UCard v-if="!activeAttempt">
          <UEmpty
            icon="i-lucide-clipboard-list"
            :title="t('quiz.noAttemptsYet')"
            :description="t('quiz.noAttemptsText')"
            :actions="[
              { label: t('quiz.start'), icon: 'i-lucide-play', to: quizPath, color: 'primary' },
              { label: t('quiz.backToLesson'), icon: 'i-lucide-arrow-left', to: lessonPath, color: 'neutral', variant: 'outline' }
            ]"
          />
        </UCard>

        <!-- Result Overview & Review -->
        <template v-else>
          <UPageHeader
            :title="ex.title"
            :description="ex.instructions || undefined"
            :ui="{ root: 'border-0 py-0', title: 'text-2xl sm:text-3xl', description: 'text-sm mt-1.5' }"
          >
            <template #headline>
              <UPageList class="flex-row flex-wrap items-center gap-1.5">
                <UBadge
                  :label="t('quiz.attemptLabel', { n: activeAttemptNumber })"
                  color="primary"
                  variant="subtle"
                  size="sm"
                />
                <UBadge
                  :label="activeAttempt.passed ? t('quiz.passedBadge') : t('quiz.notPassedBadge')"
                  :icon="activeAttempt.passed ? 'i-lucide-circle-check' : 'i-lucide-target'"
                  :color="activeAttempt.passed ? 'success' : 'warning'"
                  variant="soft"
                  size="sm"
                />
                <UBadge
                  :label="fmtDate(activeAttempt.submittedAt)"
                  icon="i-lucide-calendar"
                  color="neutral"
                  variant="outline"
                  size="sm"
                />
              </UPageList>
            </template>
            <template #links>
              <UButton
                :to="lessonPath"
                :label="t('quiz.backToLesson')"
                icon="i-lucide-arrow-left"
                color="neutral"
                variant="ghost"
                size="sm"
              />
            </template>
          </UPageHeader>

          <!-- Result Status Banner -->
          <UAlert
            :color="activeAttempt.passed ? 'success' : 'warning'"
            variant="subtle"
            :icon="activeAttempt.passed ? 'i-lucide-trophy' : 'i-lucide-target'"
            :title="activeAttempt.passed
              ? t('quiz.passedWith', { score: activeAttempt.score, got: activeAttempt.earnedPoints, of: activeAttempt.totalPoints })
              : t('quiz.scoredNeed', { score: activeAttempt.score, got: activeAttempt.earnedPoints, of: activeAttempt.totalPoints, need: ex.passingScore })"
          />

          <UAlert
            v-if="autoDone"
            color="success"
            variant="soft"
            icon="i-lucide-circle-check"
            :title="t('quiz.lessonDone')"
          />

          <UAlert
            v-if="xpEarned > 0"
            color="warning"
            variant="soft"
            icon="i-lucide-zap"
            :title="t('quiz.xpEarned', { n: xpEarned })"
          />

          <UAlert
            v-if="activeAttempt.reviewStatus === 'PENDING_REVIEW'"
            color="info"
            variant="subtle"
            icon="i-lucide-clock"
            :title="t('quiz.waitingTeacher')"
          />

          <!-- 4 Summary Stat Tiles -->
          <UPageGrid class="grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile
              :label="t('quiz.statScore')"
              :value="`${activeAttempt.score}%`"
              :hint="activeAttempt.passed ? t('quiz.passedBadge') : t('quiz.passMark', { n: ex.passingScore })"
              :color="activeAttempt.passed ? 'success' : 'warning'"
              :icon="activeAttempt.passed ? 'i-lucide-trophy' : 'i-lucide-target'"
            />
            <StatTile
              :label="t('quiz.statPoints')"
              :value="`${activeAttempt.earnedPoints} / ${activeAttempt.totalPoints}`"
              color="primary"
              icon="i-lucide-award"
            />
            <StatTile
              :label="t('quiz.statCorrect')"
              :value="`${correctCount} / ${ex.questions.length}`"
              color="info"
              icon="i-lucide-check-circle-2"
            />
            <StatTile
              :label="t('quiz.statTime')"
              :value="fmtDuration(activeAttempt.durationSeconds)"
              color="neutral"
              icon="i-lucide-timer"
            />
          </UPageGrid>

          <!-- Score Bar Card -->
          <UCard
            variant="subtle"
            :ui="{ body: 'flex flex-col gap-2.5' }"
          >
            <UProgress
              :model-value="activeAttempt.score"
              :color="activeAttempt.passed ? 'success' : 'warning'"
              size="md"
              status
            />
            <UPageList class="flex-row flex-wrap gap-2">
              <UBadge
                icon="i-lucide-target"
                :label="t('quiz.passMark', { n: ex.passingScore })"
                color="neutral"
                variant="outline"
                size="sm"
              />
              <UBadge
                icon="i-lucide-repeat"
                :label="ex.maxAttempts ? t('quiz.attempts', { n: ex.attempts.length, of: ex.maxAttempts }) : t('quiz.attemptsUsed', { n: ex.attempts.length })"
                color="neutral"
                variant="subtle"
                size="sm"
              />
              <UBadge
                v-if="ex.requiredForCompletion"
                :label="t('builder.required')"
                color="warning"
                variant="soft"
                size="sm"
              />
            </UPageList>
          </UCard>

          <!-- Review & Attempt History Tabs -->
          <UTabs
            v-model="activeTab"
            :items="tabItems"
            variant="pill"
            :content="false"
          />

          <!-- Answer Review Tab -->
          <template v-if="activeTab === 'review'">
            <UFieldGroup>
              <UButton
                :label="t('quiz.filterAll', { n: ex.questions.length })"
                :color="reviewFilter === 'all' ? 'primary' : 'neutral'"
                :variant="reviewFilter === 'all' ? 'solid' : 'outline'"
                size="sm"
                @click="reviewFilter = 'all'"
              />
              <UButton
                :label="t('quiz.filterIncorrect', { n: incorrectCount })"
                icon="i-lucide-x-circle"
                :color="reviewFilter === 'incorrect' ? 'error' : 'neutral'"
                :variant="reviewFilter === 'incorrect' ? 'solid' : 'outline'"
                size="sm"
                @click="reviewFilter = 'incorrect'"
              />
              <UButton
                :label="t('quiz.filterCorrect', { n: correctCount })"
                icon="i-lucide-check-circle-2"
                :color="reviewFilter === 'correct' ? 'success' : 'neutral'"
                :variant="reviewFilter === 'correct' ? 'solid' : 'outline'"
                size="sm"
                @click="reviewFilter = 'correct'"
              />
            </UFieldGroup>

            <UPageList
              v-if="filteredItems.length"
              class="gap-4"
            >
              <LmsQuestionPlayer
                v-for="item in filteredItems"
                :key="`${activeAttempt.id}-${item.question.id}`"
                :model-value="item.answer"
                :question="item.question"
                :index="item.index"
                :grade="item.grade"
                disabled
              />
            </UPageList>
            <UCard v-else>
              <UEmpty
                icon="i-lucide-check-check"
                :title="t('quiz.noMatchingQuestions')"
                variant="naked"
              />
            </UCard>
          </template>

          <!-- Attempt History Tab -->
          <UCard
            v-else
            :ui="{ body: 'p-0' }"
          >
            <UTable
              :data="attemptRows"
              :columns="attemptColumns"
            >
              <template #number-cell="{ row }">
                <UBadge
                  :label="`#${row.original.number}`"
                  :color="activeAttempt.id === row.original.id ? 'primary' : 'neutral'"
                  variant="subtle"
                  size="sm"
                />
              </template>
              <template #submittedAt-cell="{ row }">
                {{ fmtDate(row.original.submittedAt) }}
              </template>
              <template #score-cell="{ row }">
                <UBadge
                  :label="`${row.original.score}%`"
                  :color="row.original.passed ? 'success' : 'warning'"
                  variant="soft"
                  size="sm"
                />
              </template>
              <template #earnedPoints-cell="{ row }">
                {{ row.original.earnedPoints }} / {{ row.original.totalPoints }}
              </template>
              <template #durationSeconds-cell="{ row }">
                {{ fmtDuration(row.original.durationSeconds) }}
              </template>
              <template #passed-cell="{ row }">
                <UBadge
                  :label="row.original.reviewStatus === 'PENDING_REVIEW'
                    ? t('quiz.waitingTeacher')
                    : row.original.passed
                      ? t('quiz.passedBadge')
                      : t('quiz.notPassedBadge')"
                  :color="row.original.reviewStatus === 'PENDING_REVIEW'
                    ? 'info'
                    : row.original.passed
                      ? 'success'
                      : 'warning'"
                  variant="subtle"
                  size="sm"
                />
              </template>
              <template #action-cell="{ row }">
                <UButton
                  :label="activeAttempt.id === row.original.id ? t('quiz.viewing') : t('quiz.openAttempt')"
                  :icon="activeAttempt.id === row.original.id ? 'i-lucide-eye' : 'i-lucide-arrow-right'"
                  :color="activeAttempt.id === row.original.id ? 'primary' : 'neutral'"
                  :variant="activeAttempt.id === row.original.id ? 'soft' : 'outline'"
                  size="xs"
                  @click="selectAttempt(row.original.id)"
                />
              </template>
            </UTable>
          </UCard>

          <!-- Bottom Navigation Bar -->
          <USeparator />

          <UPageList class="flex-row flex-wrap items-center justify-between gap-2">
            <UButton
              v-if="canRetry"
              :to="quizPath"
              :label="t('quiz.retake')"
              icon="i-lucide-rotate-cw"
              color="primary"
            />
            <UPageList class="flex-row flex-wrap items-center gap-2 ms-auto">
              <UButton
                :to="lessonPath"
                :label="t('quiz.backToLesson')"
                icon="i-lucide-arrow-left"
                color="neutral"
                variant="ghost"
              />
              <UButton
                v-if="nextQuiz"
                :to="nextQuizPath"
                :label="`${t('quiz.nextQuiz')}: ${nextQuiz.title}`"
                trailing-icon="i-lucide-arrow-right"
                color="neutral"
                variant="outline"
              />
              <UButton
                v-else-if="ex.lesson.next"
                :to="ex.lesson.next.locked ? undefined : `/courses/${slug}/${ex.lesson.next.id}`"
                :disabled="ex.lesson.next.locked"
                :label="ex.lesson.next.locked ? t('lesson.nextLocked') : t('courses.next')"
                :trailing-icon="ex.lesson.next.locked ? 'i-lucide-lock' : 'i-lucide-arrow-right'"
                color="neutral"
                variant="outline"
              />
            </UPageList>
          </UPageList>
        </template>
      </template>
    </UContainer>
  </AppPage>
</template>
