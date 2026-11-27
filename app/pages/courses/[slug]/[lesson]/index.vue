<script setup lang="ts">
import type { LiveLesson } from '~/components/online/Row.vue'
import type { DripState } from '#shared/utils/lms'

/**
 * Student LMS Lesson Player:
 * - Course Curriculum Outline sidebar (layouts/course.vue)
 * - Content Drip lock screen
 * - Video, Audio, Google Meet, rich notes, PDFs, linked Exam Task,
 *   and Quiz Overview Cards (name, instructions, details & links to dedicated Quiz & Result pages)
 */
interface LessonExerciseSummary {
  id: string
  position: number
  title: string
  instructions: string | null
  exerciseType: string
  passingScore: number
  timeLimitSeconds: number | null
  maxAttempts: number | null
  requiredForCompletion: boolean
  questionCount: number
  totalPoints: number
  attemptsUsed: number
  bestScore: number | null
  passed: boolean
  lastAttemptId: string | null
  lastScore: number | null
  lastSubmittedAt: string | null
  reviewStatus: string | null
  speakingQuestions?: any[]
}

interface LessonView {
  id: string
  moduleId: string | null
  module: { id: string, title: string, position: number } | null
  title: string
  summary: string | null
  durationMinutes: number | null
  body: string | null
  videoUrl: string | null
  audioUrl?: string | null
  files: { name: string, url: string, size: number | null }[]
  task: { test: string, skill: string, partNumber: number | null, to: string, done: boolean } | null
  live: LiveLesson | null
  exercises: LessonExerciseSummary[]
  canMarkDone: boolean
  requiredPending: number
  drip: DripState
  done: boolean
  course: { id: string, slug: string, title: string, teaches: boolean, dripMode: string }
  outline: Array<{ id: string, title: string, lessons: Array<{ id: string, title: string, done: boolean, locked: boolean }> }>
  position: number
  of: number
  prev: { id: string, title: string } | null
  next: { id: string, title: string, locked: boolean } | null
}

definePageMeta({ layout: 'course' })
const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const slug = String(route.params.slug)
const refreshOutline = () => refreshNuxtData(`course-outline-${slug}`)

const { data: l, error, refresh } = await useFetch<LessonView>(() => `/api/course-lessons/${route.params.lesson}`)

const dripLocked = computed(() => {
  const err = error.value as any
  if (err?.statusCode === 403 && err?.data?.data?.code === 'DRIP_LOCKED') {
    return err.data.data.drip as DripState
  }
  return null
})

// Not in the course: to its page, which asks to enroll and then opens this lesson.
if (error.value?.statusCode === 403 && !dripLocked.value) {
  await navigateTo(`/courses/${slug}?enroll=${route.params.lesson}`)
} else if (error.value && !dripLocked.value) {
  throw createError({ statusCode: 404, statusMessage: t('courses.lessonNotFound'), fatal: true })
}

useSeoMeta({ title: () => (l.value ? `${l.value.title} · ${l.value.course.title}` : t('nav.courses')), robots: 'noindex' })

const sizeText = (n: number | null) => (n == null ? '' : n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
const taskName = computed(() => (l.value?.task ? `${skillLabel(l.value.task.skill)}${l.value.task.partNumber ? ` · ${partName(l.value.task.skill, l.value.task.partNumber)}` : ''}` : ''))

const canTakeQuiz = (ex: LessonExerciseSummary) => {
  if (!l.value) return false
  if (l.value.course.teaches) return true
  if (!ex.maxAttempts) return true
  return ex.attemptsUsed < ex.maxAttempts
}

const quizPath = (exId: string) => `/courses/${l.value!.course.slug}/${l.value!.id}/quizzes/${exId}`
const quizResultPath = (exId: string) => `/courses/${l.value!.course.slug}/${l.value!.id}/quizzes/${exId}/result`

const quizStatusBadge = (ex: LessonExerciseSummary) => {
  if (ex.passed) return { label: t('quiz.passedBadge'), icon: 'i-lucide-circle-check', color: 'success' as const }
  if (ex.reviewStatus === 'PENDING_REVIEW') return { label: t('quiz.waitingTeacher'), icon: 'i-lucide-clock', color: 'info' as const }
  if (ex.attemptsUsed > 0) return { label: t('quiz.notPassedBadge'), icon: 'i-lucide-target', color: 'warning' as const }
  return { label: t('quiz.notStarted'), icon: 'i-lucide-circle-dashed', color: 'neutral' as const }
}

const speakingExercises = computed(() => (l.value?.exercises ?? []).filter(e => e.exerciseType === 'SPEAKING'))
const quizExercises = computed(() => (l.value?.exercises ?? []).filter(e => e.exerciseType !== 'SPEAKING'))

const busy = ref(false)
async function toggleDone() {
  if (!l.value) return
  busy.value = true
  try {
    await $fetch(`/api/course-lessons/${l.value.id}/done`, { method: l.value.done ? 'DELETE' : 'POST' })
    await Promise.all([refresh(), refreshOutline(), refreshXp()])
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <!-- Content Drip Lock Screen -->
  <AppPage
    v-if="dripLocked"
    :title="t('lesson.locked')"
    icon="i-lucide-lock"
  >
    <UCard
      class="max-w-lg mx-auto"
      :ui="{ body: 'p-8 text-center flex flex-col items-center gap-4' }"
    >
      <UAvatar
        icon="i-lucide-calendar-clock"
        size="xl"
        :ui="{ root: 'bg-warning/15', icon: 'text-warning' }"
      />
      <UPageHeader
        :title="dripLocked.reason === 'PREVIOUS_INCOMPLETE' ? t('lesson.previousFirst') : dripLocked.reason === 'DATE_EXPIRED' ? t('lesson.ended') : t('lesson.soon')"
        :description="dripLocked.reason === 'PREVIOUS_INCOMPLETE'
          ? t('lesson.previousText', { title: dripLocked.previousLessonTitle || t('lesson.thePrevious') })
          : dripLocked.reason === 'DATE_NOT_STARTED' && dripLocked.availableFrom
            ? t('lesson.opensAt', { date: localeDate(dripLocked.availableFrom, intlLocale(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })
            : dripLocked.reason === 'DATE_EXPIRED' && dripLocked.availableTo
              ? t('lesson.closedAt', { date: localeDate(dripLocked.availableTo, intlLocale(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })
              : undefined"
        :ui="{ root: 'border-0 py-0 text-center', container: 'items-center', title: 'text-xl sm:text-xl', description: 'text-sm mt-1.5' }"
      />
      <UPageList class="flex-row flex-wrap justify-center gap-2">
        <UButton
          v-if="dripLocked.previousLessonId"
          :to="`/courses/${slug}/${dripLocked.previousLessonId}`"
          :label="t('lesson.toPrevious')"
          icon="i-lucide-arrow-left"
        />
        <UButton
          :to="`/courses/${slug}`"
          :label="t('lesson.toCourse')"
          color="neutral"
          variant="outline"
        />
      </UPageList>
    </UCard>
  </AppPage>

  <!-- Active Lesson Player -->
  <AppPage
    v-else-if="l"
    :title="l.course.title"
    icon="i-lucide-graduation-cap"
    wide
  >
    <UContainer class="max-w-4xl px-0 flex flex-col gap-5">
      <!-- Lesson Header -->
      <UPageHeader
        :headline="[l.module?.title, t('courses.lessonOf', { n: l.position, of: l.of }), l.durationMinutes ? t('builder.minutes', { n: l.durationMinutes }) : ''].filter(Boolean).join(' · ')"
        :title="l.title"
        :description="l.summary || undefined"
        :ui="{ root: 'border-0 py-0', headline: 'text-xs font-medium text-muted', title: 'text-2xl sm:text-3xl', description: 'text-sm mt-1' }"
      />

      <MediaVideoPlayer
        v-if="l.videoUrl"
        :src="l.videoUrl"
        :title="l.title"
      />

      <MediaWaveAudio
        v-if="l.audioUrl"
        :src="l.audioUrl"
        :title="t('media.listen')"
      />

      <UCard
        v-if="l.live"
        :ui="{ body: 'p-0' }"
      >
        <OnlineRow :lesson="l.live" />
      </UCard>

      <div
        v-if="l.body"
        class="rich-content leading-7"
        v-html="l.body"
      />

      <!-- Embedded WordPress-style Speaking Widgets appended directly to the lesson -->
      <template v-if="speakingExercises.length">
        <USeparator />

        <div class="flex flex-col gap-5">
          <CourseSpeakingWidget
            v-for="ex in speakingExercises"
            :key="ex.id"
            :course-id="l.course.id"
            :course-slug="l.course.slug"
            :lesson-id="l.id"
            :exercise="ex"
            :teaches="l.course.teaches"
            @changed="refresh"
          />
        </div>
      </template>

      <!-- Quizzes Overview Section (name, instructions, details -> links to dedicated Quiz & Result pages) -->
      <template v-if="quizExercises.length">
        <USeparator />

        <UPageHeader
          :title="`${t('builder.quizzes')} (${quizExercises.length})`"
          :ui="{ root: 'border-0 py-0', title: 'text-lg sm:text-xl' }"
        />

        <UPageList class="gap-4">
          <UCard
            v-for="ex in quizExercises"
            :key="ex.id"
            variant="outline"
            :ui="{
              header: 'flex flex-wrap items-start justify-between gap-3',
              body: 'flex flex-col gap-3',
              footer: 'flex flex-wrap items-center justify-between gap-2'
            }"
          >
            <template #header>
              <UUser
                :name="ex.title"
                :description="t(`builder.exType.${ex.exerciseType}`)"
                :avatar="{
                  icon: ex.passed ? 'i-lucide-circle-check' : 'i-lucide-list-checks',
                  ui: ex.passed ? { root: 'bg-success/15', icon: 'text-success' } : { root: 'bg-primary/10', icon: 'text-primary' }
                }"
                size="md"
              />
              <UPageList class="flex-row flex-wrap items-center gap-1.5">
                <UBadge
                  v-if="ex.requiredForCompletion"
                  :label="t('builder.required')"
                  color="warning"
                  variant="soft"
                  size="sm"
                />
                <UBadge
                  :label="quizStatusBadge(ex).label"
                  :icon="quizStatusBadge(ex).icon"
                  :color="quizStatusBadge(ex).color"
                  variant="soft"
                  size="sm"
                />
              </UPageList>
            </template>

            <UAlert
              v-if="ex.instructions"
              color="neutral"
              variant="soft"
              icon="i-lucide-info"
              :description="ex.instructions"
            />

            <UPageList class="flex-row flex-wrap gap-2">
              <UBadge
                icon="i-lucide-help-circle"
                :label="t('quiz.questionsCount', { n: ex.questionCount })"
                color="neutral"
                variant="subtle"
                size="md"
              />
              <UBadge
                v-if="ex.totalPoints > 0"
                icon="i-lucide-award"
                :label="t('quiz.pointsCount', { n: ex.totalPoints })"
                color="neutral"
                variant="subtle"
                size="md"
              />
              <UBadge
                icon="i-lucide-target"
                :label="t('quiz.passMark', { n: ex.passingScore })"
                color="neutral"
                variant="outline"
                size="md"
              />
              <UBadge
                v-if="ex.timeLimitSeconds"
                icon="i-lucide-timer"
                :label="t('quiz.timeLimit', { n: Math.max(1, Math.round(ex.timeLimitSeconds / 60)) })"
                color="info"
                variant="subtle"
                size="md"
              />
              <UBadge
                icon="i-lucide-repeat"
                :label="ex.maxAttempts ? t('quiz.attempts', { n: ex.attemptsUsed, of: ex.maxAttempts }) : t('quiz.attemptsUsed', { n: ex.attemptsUsed })"
                color="neutral"
                variant="subtle"
                size="md"
              />
            </UPageList>

            <template v-if="ex.bestScore !== null">
              <UPageList class="gap-1.5">
                <UProgress
                  :model-value="ex.bestScore"
                  :color="ex.passed ? 'success' : 'warning'"
                  size="sm"
                  status
                />
                <UBadge
                  :label="`${t('quiz.bestScore')}: ${ex.bestScore}%`"
                  :color="ex.passed ? 'success' : 'warning'"
                  variant="subtle"
                  size="xs"
                  class="self-start"
                />
              </UPageList>
            </template>

            <template #footer>
              <UButton
                v-if="ex.attemptsUsed > 0"
                :to="quizResultPath(ex.id)"
                :label="t('quiz.viewResult')"
                icon="i-lucide-bar-chart-3"
                color="neutral"
                variant="outline"
                size="sm"
              />
              <UButton
                :to="canTakeQuiz(ex) ? quizPath(ex.id) : undefined"
                :disabled="!canTakeQuiz(ex)"
                :label="ex.attemptsUsed > 0 ? t('quiz.retake') : t('quiz.start')"
                :icon="ex.attemptsUsed > 0 ? 'i-lucide-rotate-cw' : 'i-lucide-play'"
                trailing-icon="i-lucide-arrow-right"
                :color="ex.passed ? 'neutral' : 'primary'"
                :variant="ex.passed ? 'soft' : 'solid'"
                size="sm"
                class="ms-auto"
              />
            </template>
          </UCard>
        </UPageList>
      </template>

      <!-- Linked Exam Platform Practice Task -->
      <UCard
        v-if="l.task"
        :ui="{ body: 'p-4 flex flex-wrap items-center justify-between gap-3' }"
        data-testid="lesson-task"
      >
        <UUser
          :name="`${t('courses.taskTitle')}: ${taskName}`"
          :description="`${l.task.test}${l.task.done ? ` · ${t('courses.taskDone')}` : ''}`"
          :avatar="{
            icon: l.task.done ? 'i-lucide-circle-check' : 'i-lucide-clipboard-check',
            ui: l.task.done ? { root: 'bg-success/15', icon: 'text-success' } : { root: 'bg-primary/10', icon: 'text-primary' }
          }"
          size="md"
        />
        <UButton
          :to="l.task.to"
          :label="l.task.done ? t('courses.taskAgain') : t('courses.taskStart')"
          :color="l.task.done ? 'neutral' : 'primary'"
          :variant="l.task.done ? 'outline' : 'solid'"
          trailing-icon="i-lucide-arrow-right"
        />
      </UCard>

      <!-- Downloadable Handouts -->
      <UCard
        v-if="l.files.length"
        :ui="{ body: 'flex flex-col gap-2' }"
      >
        <template #header>
          <UUser
            :name="t('courses.files')"
            :avatar="{ icon: 'i-lucide-paperclip', ui: { root: 'bg-elevated', icon: 'text-muted' } }"
            size="sm"
          />
        </template>
        <UButton
          v-for="f in l.files"
          :key="f.url"
          :to="f.url"
          target="_blank"
          rel="noopener"
          external
          color="neutral"
          variant="outline"
          icon="i-lucide-file-text"
          trailing-icon="i-lucide-download"
          :label="sizeText(f.size) ? `${f.name} (${sizeText(f.size)})` : f.name"
          block
          :ui="{ base: 'justify-between' }"
        />
      </UCard>

      <!-- Completion & Prev/Next Bar -->
      <USeparator />

      <UAlert
        v-if="!l.course.teaches && !l.done && l.requiredPending > 0"
        color="warning"
        variant="subtle"
        icon="i-lucide-alert-circle"
        :title="t('quiz.requiredNote', { n: l.requiredPending })"
      />

      <UPageList class="flex-row flex-wrap items-center justify-between gap-2">
        <UButton
          v-if="!l.course.teaches"
          :label="l.done ? t('courses.doneMarked') : t('courses.markDone')"
          :icon="l.done ? 'i-lucide-circle-check' : 'i-lucide-check'"
          :color="l.done ? 'success' : 'primary'"
          :variant="l.done ? 'soft' : 'solid'"
          :loading="busy"
          :disabled="!l.done && !l.canMarkDone"
          data-testid="mark-done"
          @click="toggleDone"
        />
        <UPageList class="flex-row flex-wrap items-center gap-2 ms-auto">
          <UButton
            v-if="l.prev"
            :to="`/courses/${l.course.slug}/${l.prev.id}`"
            :label="t('courses.prev')"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
          />
          <UButton
            v-if="l.next"
            :to="l.next.locked ? undefined : `/courses/${l.course.slug}/${l.next.id}`"
            :disabled="l.next.locked"
            :label="l.next.locked ? t('lesson.nextLocked') : t('courses.next')"
            :trailing-icon="l.next.locked ? 'i-lucide-lock' : 'i-lucide-arrow-right'"
            color="neutral"
            variant="outline"
          />
        </UPageList>
      </UPageList>
    </UContainer>
  </AppPage>
</template>
