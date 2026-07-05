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
const { me } = useMe()

interface ResponseState { response: string | string[] | null, audioUrl: string | null }
const responses = reactive<Record<string, ResponseState>>({})

const section = ref<RunnerData['section']>(null)
const parts = ref<PartDto[]>([])
const questions = ref<StudentQuestionDto[]>([])
const loading = ref(true)
const submitting = ref(false)
const warnOpen = ref(false)
const notepadOpen = ref(false)
const notepad = ref('')

const sectionType = computed(() => section.value?.type)
const isListening = computed(() => sectionType.value === 'listening')
const listeningRef = ref<{ scrollToQuestion: (id: string) => void } | null>(null)

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

const numberedQuestions = computed(() =>
  [...questions.value]
    .filter(q => q.questionNumber != null)
    .sort((a, b) => (a.questionNumber! - b.questionNumber!))
)

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
  if (!auto && !confirm('Submit this section? You will not be able to change your answers.')) return
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

function exit() {
  if (confirm('Chiqishni istaysizmi? Javoblaringiz saqlanadi.')) navigateTo('/dashboard')
}

onMounted(load)
</script>

<template>
  <div class="min-h-screen flex flex-col bg-elevated/30">
    <!-- Branded top bar -->
    <header class="sticky top-0 z-20 bg-primary text-inverted shadow-sm">
      <div class="max-w-7xl mx-auto px-4 py-2 flex items-center gap-4">
        <div class="flex items-center gap-2 font-bold shrink-0">
          <UIcon
            v-if="section"
            :name="SECTION_META[section.type].icon"
            class="size-5"
          />
          <span class="hidden sm:inline">MULTI-LEVEL</span>
        </div>
        <nav class="hidden md:flex items-center gap-1.5 text-xs text-inverted/70 truncate">
          <span>Bosh sahifa</span><span>/</span>
          <span>MultiLevel Test</span><span>/</span>
          <span class="text-inverted">{{ section?.title }}</span>
        </nav>
        <div class="flex-1" />
        <div
          class="font-mono text-base font-bold px-2.5 py-0.5 rounded-md bg-inverted/15"
          :class="timer.danger.value ? 'text-error-200' : ''"
        >
          {{ timer.label.value }}
        </div>
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

    <main
      v-else
      class="flex-1 max-w-7xl w-full mx-auto px-4 py-6"
    >
      <!-- LISTENING: single page + palette sidebar -->
      <div
        v-if="isListening"
        class="grid lg:grid-cols-[1fr_280px] gap-6 items-start"
      >
        <div class="order-2 lg:order-1">
          <ExamListeningView
            ref="listeningRef"
            :parts="parts"
            :questions="questions"
            :section-audio="section?.audioUrl ?? null"
            :get-response="getResponse"
            :get-audio="getAudio"
            :is-answered="isAnswered"
            @response="onResponse"
            @audio="onAudio"
            @open-notepad="notepadOpen = true"
          />
        </div>

        <aside class="order-1 lg:order-2 lg:sticky lg:top-32 space-y-4">
          <div class="bg-default rounded-xl border border-default p-3 flex items-center gap-3">
            <UAvatar
              :src="me?.avatarUrl || undefined"
              :alt="me?.name || 'User'"
              size="md"
            />
            <div class="min-w-0">
              <p class="font-semibold text-sm truncate">
                {{ me?.name || me?.email || 'Guruh' }}
              </p>
              <p class="text-xs text-muted truncate">
                {{ me?.email }}
              </p>
            </div>
          </div>

          <div class="bg-default rounded-xl border border-default p-4 space-y-3">
            <h3 class="text-center font-bold text-sm">
              Question Palette
            </h3>
            <div class="flex items-center justify-center gap-4 text-xs">
              <span class="flex items-center gap-1.5">
                <span class="size-3 rounded-sm bg-primary" /> Answered
              </span>
              <span class="flex items-center gap-1.5">
                <span class="size-3 rounded-sm border border-default bg-default" /> Unanswered
              </span>
            </div>
            <div class="grid grid-cols-8 gap-1.5">
              <button
                v-for="q in numberedQuestions"
                :key="q.id"
                type="button"
                class="aspect-square rounded-md text-xs font-semibold flex items-center justify-center transition-colors border"
                :class="isAnswered(q)
                  ? 'bg-primary text-inverted border-primary'
                  : 'bg-default text-default border-default hover:border-primary'"
                @click="listeningRef?.scrollToQuestion(q.id)"
              >
                {{ q.questionNumber }}
              </button>
            </div>
            <div class="flex flex-col items-center gap-1 pt-2 border-t border-default">
              <UIcon
                name="i-lucide-alarm-clock"
                class="size-5 text-muted"
              />
              <div
                class="font-mono text-2xl font-bold"
                :class="timer.danger.value ? 'text-error' : 'text-default'"
              >
                {{ timer.label.value }}
              </div>
              <p class="text-xs text-muted">
                {{ answeredCount }}/{{ questions.length }} answered
              </p>
            </div>
            <UButton
              block
              color="primary"
              :loading="submitting"
              label="Topshirish"
              icon="i-lucide-check-circle"
              @click="submit(false)"
            />
            <UButton
              block
              color="warning"
              variant="outline"
              label="Chiqish"
              icon="i-lucide-log-out"
              @click="exit"
            />
          </div>
        </aside>
      </div>

      <!-- READING: split panel + part nav -->
      <div v-else-if="sectionType === 'reading'">
        <ExamReadingView
          :parts="parts"
          :questions="questions"
          :get-response="getResponse"
          :get-audio="getAudio"
          @response="onResponse"
          @audio="onAudio"
        />
        <div class="flex justify-end pt-4">
          <UButton
            :loading="submitting"
            color="primary"
            label="Topshirish"
            icon="i-lucide-check-circle"
            @click="submit(false)"
          />
        </div>
      </div>

      <!-- WRITING: split panel + part nav -->
      <div v-else-if="sectionType === 'writing'">
        <ExamWritingView
          :parts="parts"
          :questions="questions"
          :get-response="getResponse"
          @response="onResponse"
        />
        <div class="flex justify-end pt-4">
          <UButton
            :loading="submitting"
            color="primary"
            label="Topshirish"
            icon="i-lucide-check-circle"
            @click="submit(false)"
          />
        </div>
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
    </main>

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
          @click="warnOpen = false"
        />
      </template>
    </UModal>
  </div>
</template>
