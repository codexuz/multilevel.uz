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
      title: res.attempt.passed ? `Passed! ${res.attempt.score}%` : `Scored ${res.attempt.score}%`,
      description: res.autoCompletedLesson ? 'All required exercises passed — lesson marked complete!' : `${res.attempt.earnedPoints}/${res.attempt.totalPoints} points`,
      color: res.attempt.passed ? 'success' : 'warning'
    })
    emit('completed', { passed: res.attempt.passed, autoCompletedLesson: res.autoCompletedLesson })
  } catch (e) {
    toast.add({ title: 'Could not submit exercise', description: errorMessage(e), color: 'error' })
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
  <div class="flex flex-col gap-4">
    <USkeleton
      v-if="status === 'pending' && !ex"
      class="h-48 w-full rounded-2xl"
    />

    <template v-else-if="ex">
      <!-- Exercise Header Bar -->
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-elevated/60 ring ring-default p-4">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <UBadge
              :label="ex.exerciseType"
              color="primary"
              variant="subtle"
              size="xs"
            />
            <UBadge
              :label="`Pass: ${ex.passingScore}%`"
              color="neutral"
              variant="outline"
              size="xs"
            />
            <UBadge
              v-if="ex.requiredForCompletion"
              label="Required"
              color="warning"
              variant="soft"
              size="xs"
            />
            <UBadge
              v-if="ex.maxAttempts"
              :label="`Attempts: ${ex.attempts.length}/${ex.maxAttempts}`"
              color="neutral"
              variant="subtle"
              size="xs"
            />
          </div>
          <h3 class="text-base sm:text-lg font-bold text-highlighted mt-1">
            {{ ex.title }}
          </h3>
          <p
            v-if="ex.instructions"
            class="text-xs sm:text-sm text-muted mt-0.5"
          >
            {{ ex.instructions }}
          </p>
        </div>

        <div class="flex items-center gap-2 shrink-0">
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
            label="Try Again"
            icon="i-lucide-rotate-cw"
            color="primary"
            variant="soft"
            size="sm"
            @click="initRun"
          />
        </div>
      </div>

      <!-- Result Banner -->
      <UAlert
        v-if="activeResult"
        :color="activeResult.passed ? 'success' : 'warning'"
        variant="subtle"
        :icon="activeResult.passed ? 'i-lucide-trophy' : 'i-lucide-target'"
        :title="activeResult.passed ? `Passed with ${activeResult.score}% (${activeResult.earnedPoints}/${activeResult.totalPoints} pts)` : `Scored ${activeResult.score}% (${activeResult.earnedPoints}/${activeResult.totalPoints} pts) — ${ex.passingScore}% needed to pass`"
      />

      <!-- Questions -->
      <div
        v-if="ex.questions.length"
        class="flex flex-col gap-3.5"
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
      </div>
      <UEmpty
        v-else
        icon="i-lucide-help-circle"
        title="No questions in this exercise yet"
        variant="naked"
      />

      <!-- Submit Footer -->
      <div
        v-if="ex.questions.length && !activeResult"
        class="flex items-center justify-end gap-2 pt-2"
      >
        <UButton
          label="Submit Answers"
          icon="i-lucide-check-check"
          size="md"
          :loading="submitting"
          :disabled="!ex.teaches && !!ex.maxAttempts && ex.attempts.length >= ex.maxAttempts"
          @click="submit"
        />
      </div>

      <!-- Previous Attempts History -->
      <div
        v-if="ex.attempts.length"
        class="flex flex-wrap items-center gap-2 pt-2 border-t border-default text-xs text-muted"
      >
        <span class="font-medium">History:</span>
        <button
          v-for="(att, ai) in ex.attempts.slice(0, 6)"
          :key="att.id"
          type="button"
          class="px-2.5 py-1 rounded-full border text-xs font-medium transition-colors cursor-pointer"
          :class="activeResult?.id === att.id ? 'border-primary bg-primary/10 text-primary' : 'border-default hover:bg-elevated'"
          @click="viewAttempt(att)"
        >
          #{{ ex.attempts.length - ai }} · {{ att.score }}% {{ att.passed ? '✓' : '' }}
        </button>
      </div>
    </template>
  </div>
</template>
