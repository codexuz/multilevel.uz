<script setup lang="ts">
import type { BreadcrumbItem } from '@nuxt/ui'
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

definePageMeta({ layout: 'course' })

const { t } = useI18n()
const route = useRoute()
const toast = useToast()

const slug = computed(() => String(route.params.slug))
const lessonId = computed(() => String(route.params.lesson))
const exerciseId = computed(() => String(route.params.exercise))

const lessonPath = computed(() => `/courses/${slug.value}/${lessonId.value}`)
const resultPath = computed(() => `${lessonPath.value}/quizzes/${exerciseId.value}/result`)

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
  title: () => (ex.value ? `${ex.value.title} · ${ex.value.lesson.title}` : t('builder.quiz')),
  robots: 'noindex'
})

const breadcrumbs = computed<BreadcrumbItem[]>(() => {
  if (!ex.value) return []
  return [
    { label: ex.value.course.title, icon: 'i-lucide-graduation-cap', to: `/courses/${slug.value}` },
    { label: ex.value.lesson.title, icon: 'i-lucide-book-open', to: lessonPath.value },
    { label: ex.value.title, icon: 'i-lucide-list-checks' }
  ]
})

const answers = ref<Record<string, unknown>>({})
const submitting = ref(false)
const startedAt = ref(Date.now())
const secondsLeft = ref<number | null>(null)
let timer: ReturnType<typeof setInterval> | null = null

const canSubmit = computed(() => {
  if (!ex.value) return false
  if (ex.value.teaches) return true
  if (!ex.value.maxAttempts) return true
  return ex.value.attempts.length < ex.value.maxAttempts
})

const totalPoints = computed(() => (ex.value?.questions ?? []).reduce((sum, q) => sum + (q.points || 1), 0))

function isAnswered(val: unknown): boolean {
  if (val == null) return false
  if (typeof val === 'string') return val.trim().length > 0
  if (Array.isArray(val)) return val.length > 0
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>
    if ('index' in obj && typeof obj.index === 'number') return true
    return Object.values(obj).some(v => typeof v === 'string' && v.trim().length > 0)
  }
  return false
}

const answeredCount = computed(() => (ex.value?.questions ?? []).filter(q => isAnswered(answers.value[q.id])).length)
const answeredPct = computed(() => {
  const total = ex.value?.questions.length ?? 0
  return total ? Math.round((answeredCount.value / total) * 100) : 0
})

const fmtClock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

function startTimer() {
  if (timer) clearInterval(timer)
  startedAt.value = Date.now()
  if (ex.value?.timeLimitSeconds && canSubmit.value) {
    secondsLeft.value = ex.value.timeLimitSeconds
    timer = setInterval(() => {
      if (secondsLeft.value == null) return
      secondsLeft.value = Math.max(0, secondsLeft.value - 1)
      if (secondsLeft.value === 0) {
        if (timer) clearInterval(timer)
        submit()
      }
    }, 1000)
  } else {
    secondsLeft.value = null
  }
}

watch(exerciseId, () => {
  answers.value = {}
  startTimer()
})

onMounted(() => startTimer())
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

async function submit() {
  if (!ex.value || submitting.value || !canSubmit.value) return
  submitting.value = true
  if (timer) clearInterval(timer)
  try {
    const res = await $fetch<{ attempt: ExerciseAttemptDto, autoCompletedLesson: boolean, xpGained?: number }>(
      `/api/course-exercises/${ex.value.id}/submit`,
      {
        method: 'POST',
        body: {
          answers: answers.value,
          durationSeconds: Math.round((Date.now() - startedAt.value) / 1000)
        }
      }
    )
    await Promise.all([refreshNuxtData(`course-outline-${slug.value}`), refreshXp()])
    toast.add({
      title: res.attempt.passed ? t('quiz.passedToast', { score: res.attempt.score }) : t('quiz.scoredToast', { score: res.attempt.score }),
      description: res.autoCompletedLesson ? t('quiz.lessonDone') : t('quiz.points', { got: res.attempt.earnedPoints, of: res.attempt.totalPoints }),
      color: res.attempt.passed ? 'success' : 'warning'
    })
    await navigateTo({
      path: resultPath.value,
      query: {
        attempt: res.attempt.id,
        ...(res.autoCompletedLesson ? { autoDone: '1' } : {}),
        ...(res.xpGained ? { xp: String(res.xpGained) } : {})
      }
    })
  } catch (e) {
    toast.add({ title: t('quiz.notSent'), description: errorMessage(e), color: 'error' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AppPage
    :title="ex?.title || t('builder.quiz')"
    :back="lessonPath"
    icon="i-lucide-list-checks"
    wide
  >
    <template #actions>
      <UBadge
        v-if="secondsLeft !== null"
        :label="fmtClock(secondsLeft)"
        icon="i-lucide-timer"
        :color="secondsLeft < 60 ? 'error' : 'info'"
        variant="soft"
        size="lg"
      />
      <UButton
        v-if="ex?.attempts.length"
        :to="resultPath"
        :label="t('quiz.viewResult')"
        icon="i-lucide-bar-chart-3"
        color="neutral"
        variant="outline"
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

        <UPageHeader
          :title="ex.title"
          :description="ex.instructions || undefined"
          :ui="{ root: 'border-0 py-0', title: 'text-2xl sm:text-3xl', description: 'text-sm mt-1.5' }"
        >
          <template #headline>
            <UBadge
              :label="t(`builder.exType.${ex.exerciseType}`)"
              color="primary"
              variant="subtle"
              size="sm"
            />
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

        <!-- Quiz Details & Answered Progress -->
        <UCard
          variant="subtle"
          :ui="{
            header: 'flex flex-wrap items-center gap-2',
            body: 'flex flex-col gap-2'
          }"
        >
          <template #header>
            <UBadge
              icon="i-lucide-help-circle"
              :label="t('quiz.questionsCount', { n: ex.questions.length })"
              color="neutral"
              variant="subtle"
              size="md"
            />
            <UBadge
              v-if="totalPoints > 0"
              icon="i-lucide-award"
              :label="t('quiz.pointsCount', { n: totalPoints })"
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
              v-if="ex.requiredForCompletion"
              :label="t('builder.required')"
              color="warning"
              variant="soft"
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
              :label="ex.maxAttempts ? t('quiz.attempts', { n: ex.attempts.length, of: ex.maxAttempts }) : t('quiz.attemptsUsed', { n: ex.attempts.length })"
              color="neutral"
              variant="subtle"
              size="md"
            />
          </template>

          <UProgress
            :model-value="answeredPct"
            :color="answeredPct === 100 ? 'success' : 'primary'"
            size="sm"
            status
          />
          <UBadge
            :label="t('quiz.answeredProgress', { done: answeredCount, total: ex.questions.length })"
            :color="answeredCount === ex.questions.length && ex.questions.length > 0 ? 'success' : 'neutral'"
            variant="subtle"
            size="xs"
            class="self-start"
          />
        </UCard>

        <!-- Max Attempts Reached Notice -->
        <UAlert
          v-if="!canSubmit && ex.maxAttempts"
          color="warning"
          variant="subtle"
          icon="i-lucide-lock"
          :title="t('quiz.maxAttemptsReached', { max: ex.maxAttempts })"
          :actions="[{
            label: t('quiz.viewResult'),
            icon: 'i-lucide-bar-chart-3',
            to: resultPath,
            color: 'primary',
            variant: 'solid'
          }]"
        />

        <!-- Questions List -->
        <UPageList
          v-if="ex.questions.length"
          class="gap-4"
        >
          <LmsQuestionPlayer
            v-for="(q, idx) in ex.questions"
            :key="q.id"
            v-model="answers[q.id]"
            :question="q"
            :index="idx"
            :disabled="!canSubmit || submitting"
          />
        </UPageList>
        <UEmpty
          v-else
          icon="i-lucide-help-circle"
          :title="t('quiz.noQuestions')"
          :actions="[{ label: t('quiz.backToLesson'), icon: 'i-lucide-arrow-left', to: lessonPath, color: 'neutral', variant: 'outline' }]"
        />

        <!-- Submit Footer -->
        <template v-if="ex.questions.length && canSubmit">
          <USeparator />
          <UPageList class="flex-row flex-wrap items-center justify-between gap-2">
            <UBadge
              :label="t('quiz.answeredProgress', { done: answeredCount, total: ex.questions.length })"
              icon="i-lucide-check-circle-2"
              :color="answeredCount === ex.questions.length ? 'success' : 'neutral'"
              variant="subtle"
              size="md"
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
                :label="t('quiz.submit')"
                icon="i-lucide-check-check"
                :loading="submitting"
                data-testid="quiz-submit"
                @click="submit"
              />
            </UPageList>
          </UPageList>
        </template>
      </template>
    </UContainer>
  </AppPage>
</template>
