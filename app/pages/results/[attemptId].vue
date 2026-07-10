<script setup lang="ts">
import type { StudentQuestionDto } from '~/types/models'
import { SECTION_META } from '~/types/exam'

interface ResultData {
  attempt: {
    id: string
    status: string
    testId: string
    totalScore: number | null
    manualScore: number | null
    maxScore: number | null
    correctCount: number | null
    totalQuestions: number | null
    level: 'A2' | 'B1' | 'B2' | 'C1' | null
    feedback: string | null
    createdAt: string
  }
  section: { id: string, type: keyof typeof SECTION_META, title: string, videoExplanationUrl: string | null } | null
  testTitle: string
  questions: StudentQuestionDto[]
  answers: { questionId: string, response: string | string[] | null, isCorrect: boolean | null, awardedPoints: number | null }[]
}

const route = useRoute()
const attemptId = route.params.attemptId as string
const { data } = await useFetch<ResultData>(`/api/attempts/${attemptId}/result`)

if (data.value?.attempt.status === 'in_progress') {
  await navigateTo(`/exam/${attemptId}`)
}

const att = computed(() => data.value?.attempt)
const isObjective = computed(() => ['listening', 'reading'].includes(data.value?.section?.type || ''))

// CEFR band → badge colour.
const LEVEL_COLOR: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = {
  C1: 'success', B2: 'info', B1: 'warning', A2: 'neutral'
}
function levelColor(l: string | null | undefined) {
  return l ? LEVEL_COLOR[l] ?? 'neutral' : 'neutral'
}
const sortedQuestions = computed(() =>
  [...(data.value?.questions ?? [])].sort((a, b) => {
    const an = a.questionNumber ?? a.orderIndex
    const bn = b.questionNumber ?? b.orderIndex
    return an - bn
  })
)
function answerFor(qId: string) {
  return data.value?.answers.find(a => a.questionId === qId)
}
function fmt(r: string | string[] | null | undefined) {
  if (r == null) return '—'
  return Array.isArray(r) ? r.join(', ') : String(r)
}
</script>

<template>
  <UContainer class="py-8 max-w-3xl space-y-6">
    <div v-if="att && data">
      <div class="flex items-center gap-3">
        <UButton
          to="/dashboard"
          icon="i-lucide-arrow-left"
          variant="ghost"
          color="neutral"
        />
        <UIcon
          v-if="data.section"
          :name="SECTION_META[data.section.type].icon"
          class="size-6 text-primary"
        />
        <div>
          <h1 class="text-xl font-bold">
            {{ data.testTitle }} — {{ data.section?.title }}
          </h1>
          <p class="text-sm text-muted">
            {{ new Date(att.createdAt).toLocaleString() }}
          </p>
        </div>
      </div>

      <UCard class="mt-6">
        <div
          v-if="isObjective && att.status === 'graded'"
          class="flex items-center gap-6"
        >
          <div class="size-24 rounded-full flex flex-col items-center justify-center text-primary bg-primary/10">
            <span class="text-3xl font-bold leading-none">{{ att.totalScore }}</span>
            <span class="text-xs text-muted">/ 75</span>
          </div>
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <p class="text-lg font-semibold">
                Scaled score
              </p>
              <UBadge
                v-if="att.level"
                :label="att.level"
                :color="levelColor(att.level)"
                variant="subtle"
              />
            </div>
            <p class="text-muted text-sm">
              {{ att.correctCount }} of {{ att.totalQuestions }} correct · auto-graded {{ data.section?.type }}.
            </p>
          </div>
        </div>

        <div
          v-else-if="att.status === 'submitted'"
          class="flex items-center gap-3 text-warning"
        >
          <UIcon
            name="i-lucide-clock"
            class="size-6"
          />
          <div>
            <p class="font-semibold">
              Awaiting examiner review
            </p>
            <p class="text-sm text-muted">
              Your {{ data.section?.type }} responses were submitted and will be graded soon.
            </p>
          </div>
        </div>

        <div
          v-else-if="att.status === 'graded'"
          class="space-y-2"
        >
          <p class="text-lg font-semibold">
            Score: {{ att.manualScore ?? att.totalScore }} / {{ att.maxScore ?? '—' }}
          </p>
          <div v-if="att.feedback">
            <p class="text-sm font-medium">
              Examiner feedback
            </p>
            <p class="text-sm text-muted whitespace-pre-line">
              {{ att.feedback }}
            </p>
          </div>
        </div>
      </UCard>

      <div
        v-if="isObjective && att.status === 'graded'"
        class="mt-6"
      >
        <UButton
          :to="`/review/${att.id}`"
          icon="i-lucide-search-check"
          label="Review answers"
          block
          size="lg"
        />
        <p class="mt-2 text-center text-sm text-muted">
          Walk through every question with the correct answers and explanations.
        </p>
      </div>

      <div
        v-if="isObjective"
        class="mt-6 space-y-2"
      >
        <h2 class="font-semibold">
          Answer breakdown
        </h2>
        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <div class="divide-y divide-default">
            <div
              v-for="q in sortedQuestions"
              :key="q.id"
              class="space-y-3 p-3"
            >
              <div class="flex items-center gap-3">
                <UIcon
                  :name="answerFor(q.id)?.isCorrect ? 'i-lucide-check-circle' : 'i-lucide-x-circle'"
                  :class="answerFor(q.id)?.isCorrect ? 'text-success' : 'text-error'"
                  class="size-5 shrink-0"
                />
                <span class="w-8 text-sm text-muted">{{ q.questionNumber }}</span>
                <!-- eslint-disable vue/no-v-html -->
                <span
                  class="flex-1 text-sm truncate"
                  v-html="q.prompt"
                />
                <!-- eslint-enable vue/no-v-html -->
                <span class="text-sm font-mono">{{ fmt(answerFor(q.id)?.response) }}</span>
              </div>
              <div
                v-if="q.meta.fromText || q.meta.explanation"
                class="ml-16 space-y-2 rounded-lg border border-default bg-elevated/30 p-3 text-sm"
              >
                <blockquote
                  v-if="q.meta.fromText"
                  class="border-l-2 border-primary pl-3 text-muted whitespace-pre-line"
                >
                  {{ q.meta.fromText }}
                </blockquote>
                <p
                  v-if="q.meta.explanation"
                  class="text-default whitespace-pre-line"
                >
                  {{ q.meta.explanation }}
                </p>
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <div
        v-if="data.section?.type === 'reading' && data.section.videoExplanationUrl"
        class="mt-6 space-y-3"
      >
        <h2 class="font-semibold">
          Video explanation
        </h2>
        <UCard>
          <VideoPlayer :src="data.section.videoExplanationUrl" />
        </UCard>
      </div>

      <div class="mt-6 flex gap-2">
        <UButton
          :to="`/tests/${att.testId}`"
          variant="subtle"
          color="neutral"
          label="Back to test"
        />
        <UButton
          to="/dashboard"
          label="Dashboard"
        />
      </div>
    </div>
  </UContainer>
</template>
