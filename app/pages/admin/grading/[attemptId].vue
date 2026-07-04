<script setup lang="ts">
import type { Database, Attempt, Section, Part, Question, Answer } from '~/types/database.types'
import { SECTION_META } from '~/types/exam'

definePageMeta({ layout: 'admin', middleware: 'staff' })

const route = useRoute()
const attemptId = route.params.attemptId as string
const supabase = useSupabaseClient<Database>()
const user = useSupabaseUser()
const toast = useToast()

const { data } = await useAsyncData(`grade-${attemptId}`, async () => {
  const { data: attempt } = await supabase
    .from('attempts').select('*, sections(*), tests(title), profiles:user_id(full_name)').eq('id', attemptId).single()
  if (!attempt) return null
  const att = attempt as unknown as Attempt & { sections: Section, tests: { title: string }, profiles: { full_name: string | null } | null }

  const { data: parts } = await supabase.from('parts').select('*').eq('section_id', att.section_id).order('order_index')
  const partIds = ((parts as Part[]) ?? []).map(p => p.id)
  const { data: questions } = partIds.length
    ? await supabase.from('questions').select('*').in('part_id', partIds).order('order_index')
    : { data: [] }
  const { data: answers } = await supabase.from('answers').select('*').eq('attempt_id', attemptId)

  return {
    attempt: att,
    questions: (questions as Question[]) ?? [],
    answers: (answers as Answer[]) ?? []
  }
})

const att = computed(() => data.value?.attempt)
const scores = reactive<Record<string, number>>({})
const feedback = ref(att.value?.feedback ?? '')
const saving = ref(false)

// Initialise per-question scores from any prior grading
for (const q of data.value?.questions ?? []) {
  const a = data.value?.answers.find(x => x.question_id === q.id)
  scores[q.id] = a?.awarded_points != null ? Number(a.awarded_points) : 0
}

const maxScore = computed(() => (data.value?.questions ?? []).reduce((s, q) => s + Number(q.points || 0), 0))
const total = computed(() => Object.values(scores).reduce((s, v) => s + Number(v || 0), 0))

function answerFor(qId: string) {
  return data.value?.answers.find(a => a.question_id === qId)
}
function taskLabel(q: Question) {
  return (q.meta as { taskLabel?: string })?.taskLabel
}

async function saveGrade() {
  saving.value = true
  // Persist per-question awarded points
  await Promise.all((data.value?.questions ?? []).map((q) => {
    const a = answerFor(q.id)
    if (!a) return Promise.resolve()
    return supabase.from('answers').update({ awarded_points: scores[q.id] ?? 0 }).eq('id', a.id)
  }))

  const { error } = await supabase.from('attempts').update({
    status: 'graded',
    manual_score: total.value,
    total_score: total.value,
    max_score: maxScore.value,
    examiner_id: user.value?.id,
    feedback: feedback.value
  }).eq('id', attemptId)

  saving.value = false
  if (error) return toast.add({ title: error.message, color: 'error' })
  toast.add({ title: 'Graded', color: 'success', icon: 'i-lucide-check' })
  await navigateTo('/admin/grading')
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
        :name="SECTION_META[att.sections.type].icon"
        class="size-6 text-primary"
      />
      <div>
        <h1 class="text-xl font-bold">
          {{ att.tests.title }} — {{ att.sections.title }}
        </h1>
        <p class="text-sm text-muted">
          {{ att.profiles?.full_name || 'Student' }}
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
        v-if="answerFor(q.id)?.audio_url"
        :src="answerFor(q.id)!.audio_url!"
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
