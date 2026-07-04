<script setup lang="ts">
import type { Database, Section, Part, Answer, Attempt } from '~/types/database.types'
import type { StudentQuestion } from '~/components/QuestionRenderer.vue'
import { SECTION_META } from '~/types/exam'

const route = useRoute()
const attemptId = route.params.attemptId as string
const supabase = useSupabaseClient<Database>()

const { data } = await useAsyncData(`result-${attemptId}`, async () => {
  const { data: attempt } = await supabase
    .from('attempts').select('*, sections(*), tests(title)').eq('id', attemptId).single()
  if (!attempt) return null
  const att = attempt as unknown as Attempt & { sections: Section, tests: { title: string } }

  const { data: parts } = await supabase
    .from('parts').select('*').eq('section_id', att.section_id).order('order_index')
  const partIds = ((parts as Part[]) ?? []).map(p => p.id)

  let questions: StudentQuestion[] = []
  if (partIds.length) {
    const { data: qRows } = await supabase
      .from('student_questions').select('*').in('part_id', partIds).order('order_index')
    questions = (qRows as unknown as StudentQuestion[]) ?? []
  }
  const { data: answers } = await supabase.from('answers').select('*').eq('attempt_id', attemptId)

  return {
    attempt: att,
    questions,
    answers: (answers as Answer[]) ?? []
  }
})

if (data.value?.attempt.status === 'in_progress') {
  await navigateTo(`/exam/${attemptId}`)
}

const att = computed(() => data.value?.attempt)
const isObjective = computed(() => ['listening', 'reading'].includes(att.value?.sections.type || ''))
const pct = computed(() => {
  const a = att.value
  if (!a || a.total_score == null || !a.max_score) return null
  return Math.round((Number(a.total_score) / Number(a.max_score)) * 100)
})

function answerFor(qId: string) {
  return data.value?.answers.find(a => a.question_id === qId)
}
function fmtResponse(r: Answer['response']) {
  if (r == null) return '—'
  return Array.isArray(r) ? r.join(', ') : String(r)
}
</script>

<template>
  <UContainer class="py-8 max-w-3xl space-y-6">
    <div v-if="att">
      <div class="flex items-center gap-3">
        <UButton
          to="/dashboard"
          icon="i-lucide-arrow-left"
          variant="ghost"
          color="neutral"
        />
        <UIcon
          :name="SECTION_META[att.sections.type].icon"
          class="size-6 text-primary"
        />
        <div>
          <h1 class="text-xl font-bold">
            {{ att.tests.title }} — {{ att.sections.title }}
          </h1>
          <p class="text-sm text-muted">
            {{ new Date(att.created_at).toLocaleString() }}
          </p>
        </div>
      </div>

      <!-- Score summary -->
      <UCard class="mt-6">
        <div
          v-if="isObjective && att.status === 'graded'"
          class="flex items-center gap-6"
        >
          <div
            class="size-24 rounded-full flex flex-col items-center justify-center text-primary bg-primary/10"
          >
            <span class="text-2xl font-bold">{{ pct }}%</span>
          </div>
          <div>
            <p class="text-lg font-semibold">
              {{ att.total_score }} / {{ att.max_score }} correct
            </p>
            <p class="text-muted text-sm">
              Auto-graded objective section.
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
              Your {{ att.sections.type }} responses were submitted and will be graded soon.
            </p>
          </div>
        </div>

        <div
          v-else-if="att.status === 'graded'"
          class="space-y-2"
        >
          <p class="text-lg font-semibold">
            Score: {{ att.manual_score ?? att.total_score }} / {{ att.max_score ?? '—' }}
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

      <!-- Per-question breakdown (objective) -->
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
              v-for="q in data?.questions"
              :key="q.id"
              class="flex items-center gap-3 p-3"
            >
              <UIcon
                :name="answerFor(q.id)?.is_correct ? 'i-lucide-check-circle' : 'i-lucide-x-circle'"
                :class="answerFor(q.id)?.is_correct ? 'text-success' : 'text-error'"
                class="size-5 shrink-0"
              />
              <span class="w-8 text-sm text-muted">{{ q.question_number }}</span>
              <span
                class="flex-1 text-sm truncate"
                v-html="q.prompt"
              />
              <span class="text-sm font-mono">{{ fmtResponse(answerFor(q.id)?.response ?? null) }}</span>
            </div>
          </div>
        </UCard>
      </div>

      <div class="mt-6 flex gap-2">
        <UButton
          :to="`/tests/${att.test_id}`"
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
