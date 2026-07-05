<script setup lang="ts">
import type { StudentQuestionDto, PartDto } from '~/types/models'
import { SECTION_META } from '~/types/exam'

definePageMeta({ layout: 'exam' })

interface RunnerData {
  attempt: { id: string, status: string, startedAt: string, sectionId: string }
  section: { id: string, type: keyof typeof SECTION_META, title: string, durationMinutes: number, audioUrl: string | null } | null
  parts: PartDto[]
  questions: StudentQuestionDto[]
  answers: { questionId: string, response: string | string[] | null, audioUrl: string | null }[]
}

const route = useRoute()
const attemptId = route.params.attemptId as string
const toast = useToast()
const timer = useExamTimer()

interface ResponseState { response: string | string[] | null, audioUrl: string | null }
const responses = reactive<Record<string, ResponseState>>({})

const section = ref<RunnerData['section']>(null)
const parts = ref<PartDto[]>([])
const questions = ref<StudentQuestionDto[]>([])
const loading = ref(true)
const submitting = ref(false)
const warnOpen = ref(false)

const isReading = computed(() => section.value?.type === 'reading')
const isListening = computed(() => section.value?.type === 'listening')

function questionsForPart(partId: string) {
  return questions.value.filter(q => q.partId === partId)
}
function passageOf(p: PartDto) {
  return (p.content as { passage?: string })?.passage
}

async function load() {
  let data: RunnerData
  try {
    data = await $fetch<RunnerData>(`/api/attempts/${attemptId}`)
  } catch {
    toast.add({ title: 'Attempt not found', color: 'error' })
    return navigateTo('/dashboard')
  }
  if (data.attempt.status !== 'in_progress') return navigateTo(`/results/${attemptId}`)

  section.value = data.section
  parts.value = data.parts
  questions.value = data.questions

  for (const a of data.answers) responses[a.questionId] = { response: a.response, audioUrl: a.audioUrl }
  for (const q of questions.value) if (!responses[q.id]) responses[q.id] = { response: null, audioUrl: null }

  const total = (section.value?.durationMinutes || 45) * 60
  const elapsed = Math.floor((Date.now() - new Date(data.attempt.startedAt).getTime()) / 1000)
  timer.start(Math.max(1, total - elapsed), {
    onWarn: () => { warnOpen.value = true },
    onExpire: () => submit(true)
  })
  loading.value = false
}

const saveTimers: Record<string, ReturnType<typeof setTimeout>> = {}
function saveAnswer(questionId: string) {
  clearTimeout(saveTimers[questionId])
  saveTimers[questionId] = setTimeout(() => {
    const s = responses[questionId]
    if (!s) return
    $fetch(`/api/attempts/${attemptId}/answer`, {
      method: 'POST',
      body: { questionId, response: s.response, audioUrl: s.audioUrl }
    }).catch(() => {})
  }, 600)
}
function onResponse(qId: string, v: string | string[] | null) {
  const s = responses[qId]; if (s) s.response = v; saveAnswer(qId)
}
function onAudio(qId: string, v: string | null) {
  const s = responses[qId]; if (s) s.audioUrl = v; saveAnswer(qId)
}

const answeredCount = computed(() => questions.value.filter((q) => {
  const r = responses[q.id]
  if (!r) return false
  if (q.type === 'speaking_prompt') return !!r.audioUrl
  if (Array.isArray(r.response)) return r.response.length > 0
  return !!r.response
}).length)

async function submit(auto = false) {
  if (!auto && !confirm('Submit this section? You will not be able to change your answers.')) return
  submitting.value = true
  timer.stop()
  Object.values(saveTimers).forEach(clearTimeout)
  // flush
  await Promise.all(questions.value.map(q => $fetch(`/api/attempts/${attemptId}/answer`, {
    method: 'POST', body: { questionId: q.id, response: responses[q.id]?.response ?? null, audioUrl: responses[q.id]?.audioUrl ?? null }
  }).catch(() => {})))
  try {
    await $fetch(`/api/attempts/${attemptId}/submit`, { method: 'POST' })
    await navigateTo(`/results/${attemptId}`)
  } catch (e) {
    submitting.value = false
    toast.add({ title: 'Submission failed', description: (e as Error).message, color: 'error' })
  }
}

onMounted(load)
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <header class="sticky top-0 z-10 bg-default/90 backdrop-blur border-b border-default">
      <div class="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
        <div class="flex items-center gap-2 min-w-0">
          <UIcon v-if="section" :name="SECTION_META[section.type].icon" class="size-5 text-primary shrink-0" />
          <span class="font-semibold truncate">{{ section?.title }}</span>
        </div>
        <div class="flex-1" />
        <UBadge color="neutral" variant="subtle" :label="`${answeredCount}/${questions.length} answered`" />
        <div class="font-mono text-lg font-bold px-3 py-1 rounded-md" :class="timer.danger.value ? 'bg-error/10 text-error' : 'bg-elevated'">
          {{ timer.label.value }}
        </div>
        <UButton :loading="submitting" color="primary" label="Submit" icon="i-lucide-send" @click="submit(false)" />
      </div>
    </header>

    <main class="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
      <div v-if="loading" class="flex justify-center py-20">
        <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-primary" />
      </div>

      <div v-else class="space-y-8">
        <UCard v-if="isListening && section?.audioUrl">
          <p class="text-sm text-muted mb-2">
            Listen to the recording. You can play it as needed.
          </p>
          <audio :src="section.audioUrl" controls class="w-full" />
        </UCard>

        <div v-for="part in parts" :key="part.id" class="space-y-4">
          <div>
            <h2 class="text-lg font-bold">
              {{ part.title }}
            </h2>
            <p v-if="part.instructions" class="text-sm text-muted">
              {{ part.instructions }}
            </p>
          </div>

          <audio v-if="isListening && part.audioUrl" :src="part.audioUrl" controls class="w-full" />

          <div :class="isReading && passageOf(part) ? 'grid lg:grid-cols-2 gap-6' : ''">
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div
              v-if="isReading && passageOf(part)"
              class="prose prose-sm dark:prose-invert max-w-none p-4 rounded-lg bg-elevated/40 border border-default lg:sticky lg:top-20 lg:self-start"
              v-html="passageOf(part)"
            />

            <div class="space-y-6">
              <UCard v-for="q in questionsForPart(part.id)" :key="q.id">
                <QuestionRenderer
                  :question="q"
                  :response="responses[q.id]?.response"
                  :audio-url="responses[q.id]?.audioUrl"
                  @update:response="onResponse(q.id, $event)"
                  @update:audio-url="onAudio(q.id, $event)"
                />
              </UCard>
            </div>
          </div>
        </div>

        <div class="flex justify-end pb-10">
          <UButton size="lg" :loading="submitting" color="primary" label="Submit section" icon="i-lucide-send" @click="submit(false)" />
        </div>
      </div>
    </main>

    <UModal v-model:open="warnOpen" title="One minute remaining">
      <template #body>
        <p>You have one minute left. Please finish your answers — the section will submit automatically when time runs out.</p>
      </template>
      <template #footer>
        <UButton label="Continue" color="primary" @click="warnOpen = false" />
      </template>
    </UModal>
  </div>
</template>
