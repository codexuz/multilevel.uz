<script setup lang="ts">
import type { AnswerMap } from '~/types/exam'
import type { PaperSection } from '~/types/ielts'
import type { SpeakingRecording } from '~/components/exam/SpeakingExam.vue'
import { uploadFile } from '~/services/http'
import { downloadEssaysDocx, downloadEssaysPdf } from '~/utils/essay-export'

/**
 * Sitting one section, for anyone (pages/attempt/[id].vue in the erp-lms IELTS app, without an
 * attempt kept on the server): the paper comes without keys, answers are kept in this browser as they
 * are given, and handing in checks them. A signed-in candidate's attempt is saved; a guest's result is
 * shown and kept nowhere. A guest's Writing can be downloaded; Speaking can be heard back.
 */
definePageMeta({ layout: 'exam' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { loggedIn, isStaff, credits, refresh: refreshMe } = useMe()
const slug = String(route.params.slug)
const skill = String(route.params.skill).toUpperCase() as 'LISTENING' | 'READING' | 'WRITING' | 'SPEAKING'
// ?part=N: one part practised on its own.
const partNo = Number(route.query.part) || null
const partQuery = partNo ? `?part=${partNo}` : ''

const { data, error, status } = await useFetch<{ test: { id: string, slug: string, title: string, mode: string }, section: PaperSection & { speaking?: any[] } }>(
  `/api/tests/${slug}/${skill.toLowerCase()}${partQuery}`,
  { server: false }
)

useSeoMeta({ title: () => (data.value ? `${data.value.test.title} — ${SKILL_META[skill]?.label ?? 'Test'}${partNo ? ` ${partName(skill, partNo)}` : ''}` : 'Test'), robots: 'noindex' })

const section = computed(() => data.value?.section ?? null)
const parts = computed(() => (section.value?.parts ?? []).map(skill === 'LISTENING' ? transformListeningPart : transformReadingPart))
const writingParts = computed(() => (section.value?.tasks ?? []).map(transformWritingTask))
const partAudio = computed(() => Object.fromEntries(parts.value.map((p, i) => [i, p.audioUrl]).filter(([, url]) => url)))
const seconds = computed(() => section.value?.seconds ?? 3600)

// Kept in this browser as they are given: a reload or a lost connection loses nothing.
const key = `ml.paper.${slug}.${skill}${partNo ? `.${partNo}` : ''}`
const answers = ref<AnswerMap>({})
const essays = ref<Record<string, string>>({})
const startedAt = ref<string | null>(null)
const resumed = ref(false)
const saveState = ref<SaveState>('saved')
provide(SAVE_STATE, saveState)

onMounted(() => {
  try {
    const kept = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (kept) {
      answers.value = kept.answers ?? {}
      essays.value = kept.essays ?? {}
      startedAt.value = kept.startedAt ?? null
      resumed.value = Object.keys(answers.value).length > 0 || Object.values(essays.value).some(t => !!t?.trim())
    }
  } catch {}
  startedAt.value ??= new Date().toISOString()
})
function keep() {
  try { localStorage.setItem(key, JSON.stringify({ answers: answers.value, essays: essays.value, startedAt: startedAt.value })) } catch {}
}
const forget = () => {
  try { localStorage.removeItem(key) } catch {}
}

function onAnswers(next: AnswerMap) {
  answers.value = { ...answers.value, ...next }
  keep()
}
function onEssays(next: Record<string, string>) {
  essays.value = { ...essays.value, ...next }
  keep()
}

const submitting = ref(false)
usePreventLeave(() => !!section.value && !submitting.value && !practice.value && (Object.keys(answers.value).length > 0 || Object.values(essays.value).some(t => !!t?.trim())))

async function handIn(extra: { recordings?: { partId: string, audioRef: string, durationSeconds?: number }[] } = {}) {
  submitting.value = true
  try {
    const result = await $fetch<any>(`/api/tests/${slug}/${skill.toLowerCase()}/submit${partQuery}`, {
      method: 'POST',
      body: {
        answers: answersPayload(answers.value, parts.value),
        essays: Object.entries(essays.value).map(([taskId, text]) => ({ taskId, text: text ?? '' })),
        recordings: extra.recordings ?? [],
        startedAt: startedAt.value
      }
    })
    forget()
    if (result.id) return router.replace(`/results/${result.id}`)
    // A guest's result: shown once, from this tab, and kept nowhere.
    const durationSeconds = startedAt.value ? Math.round((Date.now() - Date.parse(startedAt.value)) / 1000) : null
    sessionStorage.setItem(`ml.result.${slug}.${skill}`, JSON.stringify({ ...result, durationSeconds }))
    return router.replace(`/tests/${slug}/${skill.toLowerCase()}/result`)
  } catch (e: any) {
    if (e?.statusCode === 402) {
      // No marking credit (or no Premium) after all: keep the work here and offer what is missing.
      submitting.value = false
      refreshMe()
      if (e?.data?.data?.code === 'PREMIUM_REQUIRED') premiumNeeded.value = true
      else practice.value = skill === 'SPEAKING' ? 'SPEAKING' : 'WRITING'
      return
    }
    toast.add({ title: 'Not handed in', description: e?.data?.message || e?.message || 'Check your connection and try again. Your answers are kept.', color: 'error' })
    submitting.value = false
  }
}

function finishObjective(next: AnswerMap) {
  answers.value = { ...answers.value, ...next }
  keep()
  handIn()
}

// ─── Writing and Speaking, where a guest practises: nothing is marked or sent ───
// A signed-in candidate without a marking credit lands here too, with the offer of one.
const practice = ref<'WRITING' | 'SPEAKING' | null>(null)
const canBeMarked = computed(() => loggedIn.value && (isStaff.value || credits.value > 0))
const recordings = ref<SpeakingRecording[]>([])

function finishWriting(next: Record<string, string>) {
  essays.value = { ...essays.value, ...next }
  keep()
  if (canBeMarked.value) return handIn()
  practice.value = 'WRITING'
}

async function finishSpeaking(list: SpeakingRecording[]) {
  recordings.value = list
  if (!canBeMarked.value) {
    practice.value = 'SPEAKING'
    return
  }
  submitting.value = true
  try {
    const uploaded = []
    for (const r of list) {
      const file = await uploadFile(new File([r.blob], `speaking-${r.partId}.webm`, { type: r.blob.type || 'audio/webm' }), { purpose: 'recording' })
      uploaded.push({ partId: r.partId, audioRef: file.url, durationSeconds: r.durationSeconds })
    }
    await handIn({ recordings: uploaded })
  } catch (e: any) {
    toast.add({ title: 'The recordings were not sent', description: e?.message || 'Try again.', color: 'error' })
    submitting.value = false
  }
}

const essayExport = computed(() => (section.value?.tasks ?? []).map(t => ({
  label: writingTaskLabel(t.taskNumber), prompt: t.prompt, text: essays.value[t.id] ?? '', wordCount: countWords(essays.value[t.id] ?? ''), minWords: t.minWords
})))
const downloading = ref<'pdf' | 'docx' | null>(null)
async function download(kind: 'pdf' | 'docx') {
  downloading.value = kind
  try {
    if (kind === 'pdf') await downloadEssaysPdf(data.value!.test.title, essayExport.value)
    else await downloadEssaysDocx(data.value!.test.title, essayExport.value)
  } catch (e: any) {
    toast.add({ title: 'Could not make the file', description: e?.message, color: 'error' })
  } finally {
    downloading.value = null
  }
}
function startOver() {
  forget()
  essays.value = {}
  answers.value = {}
  practice.value = null
  recordings.value = []
  startedAt.value = new Date().toISOString()
}

const leaveTo = `/tests/${slug}`
// A premium test without Premium: the paper is not sent, the offer is shown instead.
const premiumNeeded = ref(false)
watch(error, (e) => {
  if (e?.statusCode === 402) premiumNeeded.value = true
}, { immediate: true })
const practiceNote = computed(() => (loggedIn.value
  ? 'Get instant AI feedback below, or a marking credit gets it a score out of 75 and feedback from an examiner. Your work stays here.'
  : 'Sign in to have an examiner mark it.'))

const pageError = computed(() => {
  if (premiumNeeded.value) return null
  if (error.value) return error.value.statusCode === 404 ? 'This section is not available.' : 'The paper could not be opened. Check your connection and try again.'
  return null
})
</script>

<template>
  <div
    v-if="premiumNeeded"
    class="h-dvh grid place-items-center bg-muted p-4"
  >
    <BillingPaywall reason="premium">
      <UButton
        :to="leaveTo"
        label="Back to the test"
        color="neutral"
        variant="outline"
      />
    </BillingPaywall>
  </div>
  <ExamLoadState
    v-else
    :loading="status === 'pending' || status === 'idle'"
    :error="pageError"
    :back-to="leaveTo"
    back-label="Back to the test"
  >
    <div class="h-full min-h-0 flex flex-col">
      <div
        v-if="submitting"
        class="flex-1 grid place-items-center"
      >
        <div class="flex flex-col items-center gap-3 text-muted">
          <UIcon
            name="i-lucide-loader-circle"
            class="size-8 animate-spin"
          />
          <p>Handing in…</p>
        </div>
      </div>

      <!-- A guest's Writing: theirs to keep, nothing marked -->
      <div
        v-else-if="practice === 'WRITING'"
        class="flex-1 overflow-y-auto"
      >
        <div class="max-w-3xl mx-auto p-6 flex flex-col gap-5">
          <UEmpty
            icon="i-lucide-file-check"
            title="Writing finished"
            :description="`Download your answers to keep them or show a teacher. ${practiceNote}`"
            variant="naked"
          />
          <template v-if="loggedIn">
            <UButton
              v-if="canBeMarked"
              label="Hand in for marking"
              icon="i-lucide-send"
              class="self-center"
              @click="() => { practice = null; handIn() }"
            />
            <BillingPaywall
              v-else
              reason="credit"
              compact
            />
          </template>
          <AiWritingFeedback
            :slug="slug"
            :part="partNo"
            :essays="essays"
          />
          <div class="flex flex-wrap justify-center gap-2">
            <UButton
              label="Download PDF"
              icon="i-lucide-file-down"
              :loading="downloading === 'pdf'"
              @click="download('pdf')"
            />
            <UButton
              label="Download Word"
              icon="i-lucide-file-text"
              color="neutral"
              variant="outline"
              :loading="downloading === 'docx'"
              @click="download('docx')"
            />
          </div>
          <UCard
            v-for="e in essayExport"
            :key="e.label"
          >
            <template #header>
              <div class="flex items-center gap-2">
                <span class="font-semibold">{{ e.label }}</span>
                <UBadge
                  :label="`${e.wordCount} words`"
                  :color="e.minWords && e.wordCount < e.minWords ? 'warning' : 'primary'"
                  variant="soft"
                  size="sm"
                  class="ms-auto"
                />
              </div>
            </template>
            <p
              v-if="e.text.trim()"
              class="whitespace-pre-wrap leading-7 font-serif"
            >
              {{ e.text }}
            </p>
            <p
              v-else
              class="text-muted text-sm"
            >
              Not written.
            </p>
          </UCard>
          <div class="flex flex-wrap justify-center gap-2">
            <UButton
              v-if="!loggedIn"
              :to="`/login?next=${encodeURIComponent(route.fullPath)}`"
              label="Sign in to have it marked"
              icon="i-lucide-log-in"
              color="neutral"
              variant="outline"
            />
            <UButton
              label="Write again"
              icon="i-lucide-rotate-ccw"
              color="neutral"
              variant="ghost"
              @click="startOver"
            />
            <UButton
              :to="leaveTo"
              label="Back to the test"
              color="neutral"
              variant="ghost"
            />
          </div>
        </div>
      </div>

      <!-- A guest's Speaking: heard back and downloaded, nothing marked -->
      <div
        v-else-if="practice === 'SPEAKING'"
        class="flex-1 overflow-y-auto"
      >
        <div class="max-w-3xl mx-auto p-6 flex flex-col gap-4">
          <UEmpty
            icon="i-lucide-mic"
            title="Speaking finished"
            :description="`Listen to your answers and download them. ${practiceNote}`"
            variant="naked"
          />
          <template v-if="loggedIn">
            <UButton
              v-if="canBeMarked"
              label="Hand in for marking"
              icon="i-lucide-send"
              class="self-center"
              @click="() => { practice = null; finishSpeaking(recordings) }"
            />
            <BillingPaywall
              v-else
              reason="credit"
              compact
            />
          </template>
          <AiWritingFeedback
            skill="SPEAKING"
            :slug="slug"
            :part="partNo"
            :recordings="recordings"
          />
          <UCard
            v-for="r in recordings"
            :key="r.partId"
          >
            <div class="flex flex-wrap items-center gap-3">
              <span class="font-medium">{{ speakingPartLabel(section?.speaking?.find(p => p.id === r.partId)?.partNumber) }}</span>
              <audio
                :src="r.url"
                controls
                class="flex-1 min-w-52"
              />
              <UButton
                :href="r.url"
                :download="`speaking-${speakingPartLabel(section?.speaking?.find(p => p.id === r.partId)?.partNumber)}.webm`"
                icon="i-lucide-download"
                color="neutral"
                variant="outline"
                aria-label="Download"
              />
            </div>
          </UCard>
          <div class="flex flex-wrap justify-center gap-2">
            <UButton
              v-if="!loggedIn"
              :to="`/login?next=${encodeURIComponent(route.fullPath)}`"
              label="Sign in to have it marked"
              icon="i-lucide-log-in"
              color="neutral"
              variant="outline"
            />
            <UButton
              label="Try again"
              icon="i-lucide-rotate-ccw"
              color="neutral"
              variant="ghost"
              @click="startOver"
            />
            <UButton
              :to="leaveTo"
              label="Back to the test"
              color="neutral"
              variant="ghost"
            />
          </div>
        </div>
      </div>

      <template v-else-if="section">
        <ExamListeningExam
          v-if="skill === 'LISTENING'"
          :parts="parts"
          :audio-url="mediaUrl(section.audioUrl) || undefined"
          :part-audio-urls="partAudio"
          :initial-answers="answers"
          :leave-to="leaveTo"
          @save-progress="onAnswers"
          @submit="finishObjective"
        />
        <ExamReadingExam
          v-else-if="skill === 'READING'"
          :parts="parts"
          :timer-seconds="seconds"
          :initial-answers="answers"
          :leave-to="leaveTo"
          :auto-start="resumed"
          @save-progress="onAnswers"
          @submit="finishObjective"
        />
        <ExamWritingExam
          v-else-if="skill === 'WRITING'"
          :parts="writingParts"
          :timer-seconds="seconds"
          :initial-essays="essays"
          :leave-to="leaveTo"
          :auto-start="resumed"
          @save-progress="onEssays"
          @submit="finishWriting"
        />
        <ExamSpeakingExam
          v-else
          :parts="section.speaking ?? []"
          :leave-to="leaveTo"
          @submit="finishSpeaking"
        />
      </template>
    </div>
  </ExamLoadState>
</template>
