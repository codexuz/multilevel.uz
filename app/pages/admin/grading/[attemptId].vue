<script setup lang="ts">
import type { SectionType } from '~/types/exam'
import { SECTION_META } from '~/types/exam'

definePageMeta({ layout: 'admin', middleware: 'staff' })

const route = useRoute()
const attemptId = route.params.attemptId as string
const toast = useToast()

interface GQuestion {
  id: string
  type: string
  questionNumber: number | null
  prompt: string | null
  points: number
  meta: { taskLabel?: string } | null
}
interface GAnswer {
  id: string
  questionId: string
  response: string | string[] | null
  audioUrl: string | null
  awardedPoints: number | null
}
interface GData {
  attempt: {
    id: string
    feedback: string | null
    sectionType: SectionType
    sectionTitle: string
    testTitle: string
    studentName: string | null
  }
  questions: GQuestion[]
  answers: GAnswer[]
}

const { data } = await useFetch<GData>(`/api/admin/grading/${attemptId}`)

const att = computed(() => data.value?.attempt)
const scores = reactive<Record<string, number>>({})
const feedback = ref(att.value?.feedback ?? '')
const saving = ref(false)

// Initialise per-question scores from any prior grading
for (const q of data.value?.questions ?? []) {
  const a = data.value?.answers.find(x => x.questionId === q.id)
  scores[q.id] = a?.awardedPoints != null ? Number(a.awardedPoints) : 0
}

const maxScore = computed(() => (data.value?.questions ?? []).reduce((s, q) => s + Number(q.points || 0), 0))
const total = computed(() => Object.values(scores).reduce((s, v) => s + Number(v || 0), 0))

function answerFor(qId: string) {
  return data.value?.answers.find(a => a.questionId === qId)
}
function taskLabel(q: GQuestion) {
  return q.meta?.taskLabel
}

async function saveGrade() {
  saving.value = true
  try {
    await $fetch(`/api/admin/grading/${attemptId}`, {
      method: 'POST',
      body: { scores, feedback: feedback.value, maxScore: maxScore.value }
    })
    toast.add({ title: 'Graded', color: 'success', icon: 'i-lucide-check' })
    await navigateTo('/admin/grading')
  } catch (e) {
    toast.add({ title: (e as { data?: { message?: string } })?.data?.message ?? 'Failed', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div
    v-if="att"
    class="max-w-3xl space-y-6"
  >
    <div class="flex items-center gap-3">
      <UButton
        to="/admin/grading"
        icon="i-lucide-arrow-left"
        variant="ghost"
        color="neutral"
      />
      <UIcon
        :name="SECTION_META[att.sectionType].icon"
        class="size-6 text-primary"
      />
      <div>
        <h1 class="text-xl font-bold">
          {{ att.testTitle }} — {{ att.sectionTitle }}
        </h1>
        <p class="text-sm text-muted">
          {{ att.studentName || 'Student' }}
        </p>
      </div>
    </div>

    <UCard
      v-for="q in data?.questions"
      :key="q.id"
      :ui="{ body: 'space-y-3' }"
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <UBadge
            v-if="taskLabel(q)"
            color="neutral"
            variant="subtle"
            :label="`Task ${taskLabel(q)}`"
            size="sm"
            class="mb-1"
          />
          <p
            class="font-medium"
            v-html="q.prompt"
          />
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <UInput
            v-model.number="scores[q.id]"
            type="number"
            :min="0"
            :max="q.points"
            step="0.5"
            class="w-20"
          />
          <span class="text-sm text-muted">/ {{ q.points }}</span>
        </div>
      </div>

      <!-- Speaking audio -->
      <audio
        v-if="answerFor(q.id)?.audioUrl"
        :src="answerFor(q.id)!.audioUrl!"
        controls
        class="w-full"
      />

      <!-- Essay / text -->
      <div
        v-else-if="answerFor(q.id)?.response"
        class="p-3 rounded-lg bg-elevated/40 border border-default text-sm whitespace-pre-line"
      >
        {{ Array.isArray(answerFor(q.id)!.response) ? (answerFor(q.id)!.response as string[]).join(', ') : answerFor(q.id)!.response }}
      </div>
      <p
        v-else
        class="text-sm text-muted italic"
      >
        No answer submitted.
      </p>
    </UCard>

    <UCard :ui="{ body: 'space-y-4' }">
      <UFormField label="Overall feedback">
        <UTextarea
          v-model="feedback"
          class="w-full"
          :rows="4"
          placeholder="Feedback for the student…"
        />
      </UFormField>
      <div class="flex items-center justify-between">
        <p class="text-lg font-semibold">
          Total: {{ total }} / {{ maxScore }}
        </p>
        <UButton
          :loading="saving"
          color="primary"
          icon="i-lucide-check"
          label="Save grade"
          @click="() => { saveGrade() }"
        />
      </div>
    </UCard>
  </div>
</template>
