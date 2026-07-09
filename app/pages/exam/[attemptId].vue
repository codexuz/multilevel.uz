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
const { confirm } = useConfirm()
const timer = useExamTimer()

interface ResponseState { response: string | string[] | null, audioUrl: string | null }
const responses = reactive<Record<string, ResponseState>>({})

const section = ref<RunnerData['section']>(null)
const parts = ref<PartDto[]>([])
const questions = ref<StudentQuestionDto[]>([])
const loading = ref(true)
const submitting = ref(false)
const warnOpen = ref(false)
const notepadOpen = ref(false)
const settingsOpen = ref(false)
const notepad = ref('')

// Text size + contrast mode for the runner (persisted across sections).
const { settings } = useExamSettings()

const sectionType = computed(() => section.value?.type)
const isListening = computed(() => sectionType.value === 'listening')
const isReading = computed(() => sectionType.value === 'reading')
// Reading & Listening use the full-screen split runner with a bottom nav bar.
const isRunner = computed(() => isListening.value || isReading.value)
// Listening is paced by the audio and Speaking by per-prompt timers, so neither
// shows a section countdown — only Reading & Writing do.
const showTimer = computed(() => isReading.value || sectionType.value === 'writing')

function getResponse(id: string) {
  return responses[id]?.response
}
function getAudio(id: string) {
  return responses[id]?.audioUrl
}

function isAnswered(q: StudentQuestionDto) {
  const r = responses[q.id]
  if (!r) return false
  if (q.type === 'speaking_prompt') return !!r.audioUrl
  if (Array.isArray(r.response)) return r.response.length > 0
  return !!r.response
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

  // Listening is paced by the audio and Speaking by per-prompt timers, so
  // neither has a section time limit or auto-submit — only Reading & Writing.
  if (showTimer.value) {
    const total = (section.value?.durationMinutes || 45) * 60
    const elapsed = Math.floor((Date.now() - new Date(data.attempt.startedAt).getTime()) / 1000)
    timer.start(Math.max(1, total - elapsed), {
      onWarn: () => { warnOpen.value = true },
      onExpire: () => submit(true)
    })
  }
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
  const s = responses[qId]
  if (s) s.response = v
  saveAnswer(qId)
}
function onAudio(qId: string, v: string | null) {
  const s = responses[qId]
  if (s) s.audioUrl = v
  saveAnswer(qId)
}

const answeredCount = computed(() => questions.value.filter(isAnswered).length)

async function submit(auto = false) {
  if (!auto && !await confirm({
    title: 'Submit this section?',
    description: 'You will not be able to change your answers.',
    confirmLabel: 'Submit'
  })) return
  submitting.value = true
  timer.stop()
  Object.values(saveTimers).forEach(clearTimeout)
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

async function exit() {
  if (await confirm({
    title: 'Chiqishni istaysizmi?',
    description: 'Javoblaringiz saqlanadi.',
    confirmLabel: 'Chiqish'
  })) navigateTo('/dashboard')
}

onMounted(load)
</script>

<template>
  <div
    class="h-screen flex flex-col bg-default overflow-hidden"
    :data-exam-contrast="settings.contrast === 'default' ? undefined : settings.contrast"
  >
    <!-- Branded top bar -->
    <header class="shrink-0 z-20 bg-primary text-inverted shadow-sm">
      <div class="w-full px-4 py-2 flex items-center gap-3">
        <div class="flex items-center gap-2 font-bold shrink-0">
          <UIcon
            v-if="section"
            :name="SECTION_META[section.type].icon"
            class="size-5"
          />
          <span class="hidden sm:inline">MULTI-LEVEL</span>
        </div>
        <div class="flex-1" />

        <template v-if="!loading">
          <span class="hidden sm:inline text-xs text-inverted/80 font-medium">
            {{ answeredCount }}/{{ questions.length }} javob
          </span>
          <div
            v-if="showTimer"
            class="font-mono text-base font-bold px-2.5 py-0.5 rounded-md bg-inverted/15"
            :class="timer.danger.value ? 'text-error-200' : ''"
          >
            {{ timer.label.value }}
          </div>

          <UButton
            icon="i-lucide-type"
            color="neutral"
            variant="ghost"
            size="sm"
            class="text-inverted hover:bg-inverted/15"
            aria-label="Ko'rinish sozlamalari"
            @click="() => { settingsOpen = true }"
          />
          <UButton
            icon="i-lucide-notebook-pen"
            color="neutral"
            variant="ghost"
            size="sm"
            class="text-inverted hover:bg-inverted/15"
            aria-label="Blaknot"
            @click="() => { notepadOpen = true }"
          />
          <UButton
            icon="i-lucide-check-circle"
            label="Topshirish"
            color="neutral"
            size="sm"
            :loading="submitting"
            @click="submit(false)"
          />
          <UButton
            icon="i-lucide-log-out"
            color="neutral"
            variant="ghost"
            size="sm"
            class="text-inverted hover:bg-inverted/15"
            aria-label="Chiqish"
            @click="exit"
          />
        </template>
      </div>
    </header>

    <div
      v-if="loading"
      class="flex-1 flex justify-center py-20"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 animate-spin text-primary"
      />
    </div>

    <!-- READING & LISTENING: full-screen split runner with bottom nav -->
    <div
      v-else-if="isRunner"
      class="flex-1 min-h-0"
    >
      <ExamListeningView
        v-if="isListening"
        :parts="parts"
        :questions="questions"
        :section-audio="section?.audioUrl ?? null"
        :get-response="getResponse"
        :get-audio="getAudio"
        :is-answered="isAnswered"
        @response="onResponse"
        @audio="onAudio"
      />
      <ExamReadingView
        v-else
        :parts="parts"
        :questions="questions"
        :get-response="getResponse"
        :get-audio="getAudio"
        :is-answered="isAnswered"
        @response="onResponse"
        @audio="onAudio"
      />
    </div>

    <!-- WRITING & SPEAKING: padded, scrollable page -->
    <main
      v-else
      class="flex-1 min-h-0 overflow-auto"
    >
      <div class="max-w-7xl w-full mx-auto px-4 py-6">
        <!-- WRITING -->
        <div v-if="sectionType === 'writing'">
          <ExamWritingView
            :parts="parts"
            :questions="questions"
            :get-response="getResponse"
            @response="onResponse"
          />
        </div>

        <!-- SPEAKING: auto-advance; the view owns the save step -->
        <div v-else-if="sectionType === 'speaking'">
          <ExamSpeakingView
            :questions="questions"
            :get-audio="getAudio"
            :submitting="submitting"
            @audio="onAudio"
            @save="submit(true)"
          />
        </div>
      </div>
    </main>

    <ExamSettingsModal v-model:open="settingsOpen" />

    <UModal
      v-model:open="notepadOpen"
      title="Blaknot"
    >
      <template #body>
        <UTextarea
          v-model="notepad"
          :rows="12"
          class="w-full"
          placeholder="Yozib olish uchun joy…"
          autoresize
        />
      </template>
    </UModal>

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
          @click="() => { warnOpen = false }"
        />
      </template>
    </UModal>
  </div>
</template>
