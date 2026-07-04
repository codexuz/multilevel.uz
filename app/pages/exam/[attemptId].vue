<script setup lang="ts">
import type { Database, Section, Part, Answer } from '~/types/database.types'
import type { StudentQuestion } from '~/components/QuestionRenderer.vue'
import { SECTION_META } from '~/types/exam'

definePageMeta({ layout: 'exam' })

const route = useRoute()
const attemptId = route.params.attemptId as string
const supabase = useSupabaseClient<Database>()
const toast = useToast()
const timer = useExamTimer()

interface ResponseState { response: string | string[] | null, audioUrl: string | null }
const responses = reactive<Record<string, ResponseState>>({})

const section = ref<Section | null>(null)
const parts = ref<Part[]>([])
const questions = ref<StudentQuestion[]>([])
const loading = ref(true)
const submitting = ref(false)
const warnOpen = ref(false)

const isReading = computed(() => section.value?.type === 'reading')
const isListening = computed(() => section.value?.type === 'listening')

function questionsForPart(partId: string) {
  return questions.value.filter(q => (q as StudentQuestion & { part_id: string }).part_id === partId)
}

async function load() {
  const { data: attempt } = await supabase
    .from('attempts')
    .select('*, sections(*)')
    .eq('id', attemptId)
    .single()

  if (!attempt) {
    toast.add({ title: 'Attempt not found', color: 'error' })
    return navigateTo('/dashboard')
  }
  const att = attempt as unknown as { status: string, section_id: string, started_at: string, sections: Section }
  if (att.status !== 'in_progress') return navigateTo(`/results/${attemptId}`)

  section.value = att.sections

  const { data: partRows } = await supabase
    .from('parts').select('*').eq('section_id', att.section_id).order('order_index')
  parts.value = (partRows as Part[]) ?? []

  const partIds = parts.value.map(p => p.id)
  if (partIds.length) {
    const { data: qRows } = await supabase
      .from('student_questions').select('*').in('part_id', partIds).order('order_index')
    questions.value = (qRows as unknown as StudentQuestion[]) ?? []
  }

  const { data: answerRows } = await supabase
    .from('answers').select('*').eq('attempt_id', attemptId)
  for (const a of (answerRows as Answer[]) ?? []) {
    responses[a.question_id] = {
      response: a.response as string | string[] | null,
      audioUrl: a.audio_url
    }
  }
  for (const q of questions.value) {
    if (!responses[q.id]) responses[q.id] = { response: null, audioUrl: null }
  }

  // Timer from elapsed since started_at
  const total = (section.value.duration_minutes || 45) * 60
  const elapsed = Math.floor((Date.now() - new Date(att.started_at).getTime()) / 1000)
  const remaining = Math.max(1, total - elapsed)
  timer.start(remaining, {
    onWarn: () => { warnOpen.value = true },
    onExpire: () => submit(true)
  })

  loading.value = false
}

function onResponse(questionId: string, value: string | string[] | null) {
  const state = responses[questionId]
  if (state) state.response = value
  saveAnswer(questionId)
}
function onAudio(questionId: string, value: string | null) {
  const state = responses[questionId]
  if (state) state.audioUrl = value
  saveAnswer(questionId)
}

const saveTimers: Record<string, ReturnType<typeof setTimeout>> = {}
function saveAnswer(questionId: string) {
  clearTimeout(saveTimers[questionId])
  saveTimers[questionId] = setTimeout(async () => {
    const state = responses[questionId]
    if (!state) return
    await supabase.from('answers').upsert({
      attempt_id: attemptId,
      question_id: questionId,
      response: state.response as Database['public']['Tables']['answers']['Row']['response'],
      audio_url: state.audioUrl
    }, { onConflict: 'attempt_id,question_id' })
  }, 600)
}

const answeredCount = computed(() =>
  questions.value.filter((q) => {
    const r = responses[q.id]
    if (!r) return false
    if (q.type === 'speaking_prompt') return !!r.audioUrl
    if (Array.isArray(r.response)) return r.response.length > 0
    return !!r.response
  }).length
)

async function submit(auto = false) {
  if (!auto && !confirm('Submit this section? You will not be able to change your answers.')) return
  submitting.value = true
  timer.stop()
  // flush pending saves
  Object.values(saveTimers).forEach(clearTimeout)
  await Promise.all(questions.value.map(q =>
    supabase.from('answers').upsert({
      attempt_id: attemptId,
      question_id: q.id,
      response: responses[q.id]?.response as Database['public']['Tables']['answers']['Row']['response'],
      audio_url: responses[q.id]?.audioUrl ?? null
    }, { onConflict: 'attempt_id,question_id' })
  ))
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
    <!-- Exam header -->
    <header class="sticky top-0 z-10 bg-default/90 backdrop-blur border-b border-default">
      <div class="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
        <div class="flex items-center gap-2 min-w-0">
          <UIcon
            v-if="section"
            :name="SECTION_META[section.type].icon"
            class="size-5 text-primary shrink-0"
          />
          <span class="font-semibold truncate">{{ section?.title }}</span>
        </div>
        <div class="flex-1" />
        <UBadge
          color="neutral"
          variant="subtle"
          :label="`${answeredCount}/${questions.length} answered`"
        />
        <div
          class="font-mono text-lg font-bold px-3 py-1 rounded-md"
          :class="timer.danger.value ? 'bg-error/10 text-error' : 'bg-elevated'"
        >
          {{ timer.label.value }}
        </div>
        <UButton
          :loading="submitting"
          color="primary"
          label="Submit"
          icon="i-lucide-send"
          @click="submit(false)"
        />
      </div>
    </header>

    <main class="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
      <div
        v-if="loading"
        class="flex justify-center py-20"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-8 animate-spin text-primary"
        />
      </div>

      <div
        v-else
        class="space-y-8"
      >
        <!-- Listening section audio -->
        <UCard v-if="isListening && section?.audio_url">
          <p class="text-sm text-muted mb-2">
            Listen to the recording. You can play it as needed.
          </p>
          <audio
            :src="section.audio_url"
            controls
            class="w-full"
          />
        </UCard>

        <div
          v-for="part in parts"
          :key="part.id"
          class="space-y-4"
        >
          <div>
            <h2 class="text-lg font-bold">
              {{ part.title }}
            </h2>
            <p
              v-if="part.instructions"
              class="text-sm text-muted"
            >
              {{ part.instructions }}
            </p>
          </div>

          <!-- Part audio (listening) -->
          <audio
            v-if="isListening && part.audio_url"
            :src="part.audio_url"
            controls
            class="w-full"
          />

          <div :class="isReading && (part.content as any)?.passage ? 'grid lg:grid-cols-2 gap-6' : ''">
            <!-- Reading passage -->
            <div
              v-if="isReading && (part.content as any)?.passage"
              class="prose prose-sm dark:prose-invert max-w-none p-4 rounded-lg bg-elevated/40 border border-default lg:sticky lg:top-20 lg:self-start"
              v-html="(part.content as any).passage"
            />

            <div class="space-y-6">
              <UCard
                v-for="q in questionsForPart(part.id)"
                :key="q.id"
              >
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
          <UButton
            size="lg"
            :loading="submitting"
            color="primary"
            label="Submit section"
            icon="i-lucide-send"
            @click="submit(false)"
          />
        </div>
      </div>
    </main>

    <!-- One minute warning -->
    <UModal
      v-model:open="warnOpen"
      title="One minute remaining"
    >
      <template #body>
        <p>You have one minute left. Please finish your answers — the section will submit automatically when time runs out.</p>
      </template>
      <template #footer>
        <UButton
          label="Continue"
          color="primary"
          @click="warnOpen = false"
        />
      </template>
    </UModal>
  </div>
</template>
