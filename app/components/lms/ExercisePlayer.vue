<script setup lang="ts">
import type { LmsExerciseDto, LmsQuestionDto, LmsQuestionGrade } from '#shared/utils/lms'

interface ExerciseAttemptDto {
  id: string
  score: number
  earnedPoints: number
  totalPoints: number
  passed: boolean
  answers: Record<string, unknown>
  results: Record<string, LmsQuestionGrade>
  submittedAt: string
}

interface ExercisePayload extends LmsExerciseDto {
  teaches: boolean
  questions: LmsQuestionDto[]
  attempts: ExerciseAttemptDto[]
}

const props = defineProps<{ exerciseId: string }>()
const emit = defineEmits<{ completed: [{ passed: boolean, autoCompletedLesson: boolean }] }>()
const { t } = useI18n()

const toast = useToast()
const { data: ex, status, refresh } = await useFetch<ExercisePayload>(() => `/api/course-exercises/${props.exerciseId}`)

const answers = ref<Record<string, unknown>>({})
const activeResult = ref<ExerciseAttemptDto | null>(null)
const submitting = ref(false)
const startedAt = ref(Date.now())
const secondsLeft = ref<number | null>(null)
let timer: ReturnType<typeof setInterval> | null = null

function initRun() {
  answers.value = {}
  activeResult.value = null
  startedAt.value = Date.now()
  if (timer) clearInterval(timer)
  if (ex.value?.timeLimitSeconds) {
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

watch(() => props.exerciseId, () => initRun())
watch(ex, (v) => {
  if (!v) return
  if (v.timeLimitSeconds && secondsLeft.value === null && !activeResult.value) initRun()
}, { immediate: true })

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

const canRetry = computed(() => {
  if (!ex.value) return false
  if (ex.value.teaches) return true
  if (!ex.value.maxAttempts) return true
  return ex.value.attempts.length < ex.value.maxAttempts
})

const fmtClock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

async function submit() {
  if (!ex.value || submitting.value || activeResult.value) return
  submitting.value = true
  if (timer) clearInterval(timer)
  try {
    const res = await $fetch<{ attempt: ExerciseAttemptDto, autoCompletedLesson: boolean }>(`/api/course-exercises/${ex.value.id}/submit`, {
      method: 'POST',
      body: {
        answers: answers.value,
        durationSeconds: Math.round((Date.now() - startedAt.value) / 1000)
      }
    })
    activeResult.value = res.attempt
    await refresh()
    toast.add({
      title: res.attempt.passed ? t('quiz.passedToast', { score: res.attempt.score }) : t('quiz.scoredToast', { score: res.attempt.score }),
      description: res.autoCompletedLesson ? t('quiz.lessonDone') : t('quiz.points', { got: res.attempt.earnedPoints, of: res.attempt.totalPoints }),
      color: res.attempt.passed ? 'success' : 'warning'
    })
    emit('completed', { passed: res.attempt.passed, autoCompletedLesson: res.autoCompletedLesson })
  } catch (e) {
    toast.add({ title: t('quiz.notSent'), description: errorMessage(e), color: 'error' })
  } finally {
    submitting.value = false
  }
}

function viewAttempt(att: ExerciseAttemptDto) {
  answers.value = structuredClone(att.answers ?? {})
  activeResult.value = att
}
</script>

<template>
  <UPageList class="gap-4">
    <USkeleton
      v-if="status === 'pending' && !ex"
      class="h-48 w-full rounded-2xl"
    />

    <template v-else-if="ex">
      <!-- Exercise Header Card -->
      <UCard
        variant="subtle"
        :ui="{
          header: 'flex flex-wrap items-center justify-between gap-2',
          body: 'flex flex-col gap-1.5'
        }"
      >
        <template #header>
          <UPageList class="flex-row flex-wrap gap-2">
            <UBadge
              :label="t(`builder.exType.${ex.exerciseType}`)"
              color="primary"
              variant="subtle"
              size="xs"
            />
            <UBadge
              :label="t('quiz.passMark', { n: ex.passingScore })"
              color="neutral"
              variant="outline"
              size="xs"
            />
            <UBadge
              v-if="ex.requiredForCompletion"
              :label="t('builder.required')"
              color="warning"
              variant="soft"
              size="xs"
            />
            <UBadge
              v-if="ex.maxAttempts"
              :label="t('quiz.attempts', { n: ex.attempts.length, of: ex.maxAttempts })"
              color="neutral"
              variant="subtle"
              size="xs"
            />
          </UPageList>

          <UPageList class="flex-row items-center gap-2">
            <UBadge
              v-if="secondsLeft !== null && !activeResult"
              :label="fmtClock(secondsLeft)"
              icon="i-lucide-timer"
              :color="secondsLeft < 60 ? 'error' : 'info'"
              variant="soft"
              size="md"
            />
            <UButton
              v-if="activeResult && canRetry"
              :label="t('tp.tryAgain')"
              icon="i-lucide-rotate-cw"
              color="primary"
              variant="soft"
              size="sm"
              @click="initRun"
            />
          </UPageList>
        </template>

        <UPageHeader
          :title="ex.title"
          :description="ex.instructions || undefined"
          :ui="{ root: 'border-0 py-0', title: 'text-base sm:text-lg', description: 'text-xs sm:text-sm mt-0.5' }"
        />
      </UCard>

      <!-- Result Banner -->
      <UAlert
        v-if="activeResult"
        :color="activeResult.passed ? 'success' : 'warning'"
        variant="subtle"
        :icon="activeResult.passed ? 'i-lucide-trophy' : 'i-lucide-target'"
        :title="activeResult.passed ? t('quiz.passedWith', { score: activeResult.score, got: activeResult.earnedPoints, of: activeResult.totalPoints }) : t('quiz.scoredNeed', { score: activeResult.score, got: activeResult.earnedPoints, of: activeResult.totalPoints, need: ex.passingScore })"
      />

      <!-- Questions -->
      <UPageList
        v-if="ex.questions.length"
        class="gap-3.5"
      >
        <LmsQuestionPlayer
          v-for="(q, idx) in ex.questions"
          :key="q.id"
          v-model="answers[q.id]"
          :question="q"
          :index="idx"
          :grade="activeResult?.results?.[q.id] ?? null"
          :disabled="!!activeResult"
        />
      </UPageList>
      <UEmpty
        v-else
        icon="i-lucide-help-circle"
        :title="t('quiz.noQuestions')"
        variant="naked"
      />

      <!-- Submit Footer -->
      <UPageList
        v-if="ex.questions.length && !activeResult"
        class="flex-row items-center justify-end gap-2"
      >
        <UButton
          :label="t('quiz.submit')"
          icon="i-lucide-check-check"
          size="md"
          :loading="submitting"
          :disabled="!ex.teaches && !!ex.maxAttempts && ex.attempts.length >= ex.maxAttempts"
          @click="submit"
        />
      </UPageList>

      <!-- Previous Attempts History -->
      <template v-if="ex.attempts.length">
        <USeparator />
        <UPageList class="flex-row flex-wrap items-center gap-2">
          <UBadge
            :label="t('quiz.tabHistory')"
            icon="i-lucide-history"
            color="neutral"
            variant="subtle"
            size="sm"
          />
          <UButton
            v-for="(att, ai) in ex.attempts.slice(0, 6)"
            :key="att.id"
            :label="`#${ex.attempts.length - ai} · ${att.score}%${att.passed ? ' ✓' : ''}`"
            :color="activeResult?.id === att.id ? 'primary' : att.passed ? 'success' : 'neutral'"
            :variant="activeResult?.id === att.id ? 'soft' : 'outline'"
            size="xs"
            @click="viewAttempt(att)"
          />
        </UPageList>
      </template>
    </template>
  </UPageList>
</template>
