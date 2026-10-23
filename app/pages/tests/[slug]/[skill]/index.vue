<script setup lang="ts">
import type { AnswerMap } from '~/types/exam'
import type { PaperSection } from '~/types/ielts'
import type { SpeakingRecording } from '~/components/exam/SpeakingExam.vue'
import { uploadFile } from '~/services/http'
import { downloadEssaysDocx, downloadEssaysPdf } from '~/utils/essay-export'

const { t } = useI18n()

/**
 * Sitting one section, for anyone (pages/attempt/[id].vue in the erp-lms IELTS app, without an
 * attempt kept on the server): the paper comes without keys, answers are kept in this browser as they
 * are given, and handing in checks them. A signed-in candidate's attempt is saved; a guest's result is
 * shown and kept nowhere. A guest's Writing can be downloaded; Speaking can be heard back.
 * IELTS Listening, Reading and Writing sit on the computer-delivered IELTS screen (components/ix,
 * from the erp-lms IELTS app); Multilevel on Mockmee's own.
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

const { data, error, status } = await useFetch<{ test: { id: string, slug: string, title: string, mode: string }, seat?: boolean, section: PaperSection & { speaking?: any[] } }>(
  `/api/tests/${slug}/${skill.toLowerCase()}${partQuery}`,
  { server: false }
)

useSeoMeta({ title: () => (data.value ? `${data.value.test.title} — ${skillLabel(skill)}${partNo ? ` ${partName(skill, partNo)}` : ''}` : t('sit.test')), robots: 'noindex' })

const section = computed(() => data.value?.section ?? null)
const parts = computed(() => (section.value?.parts ?? []).map(skill === 'LISTENING' ? transformListeningPart : transformReadingPart))
const writingParts = computed(() => (section.value?.tasks ?? []).map(transformWritingTask))
const partAudio = computed(() => Object.fromEntries(parts.value.map((p, i) => [i, p.audioUrl]).filter(([, url]) => url)))
const seconds = computed(() => section.value?.seconds ?? 3600)
const ielts = computed(() => section.value?.exam === 'IELTS')

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
  integrity.reset()
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
// At a mock session's seat (the paper says so), what the page sees goes to the invigilator's board,
// from Start on (the cover before it is not the test); practice and live mocks keep nothing.
const atSeat = computed(() => !!data.value?.seat)
const begun = ref(false)
const integrity = useIntegrity(key, { active: () => atSeat.value && begun.value && !submitting.value })
let pinger: ReturnType<typeof setInterval> | undefined
const sendPing = () => $fetch('/api/seat/ping', { method: 'POST', body: { skill, signals: integrity.signals } }).catch(() => {})
watch([atSeat, begun], ([seat, on]) => {
  clearInterval(pinger)
  if (seat && on) {
    sendPing()
    pinger = setInterval(sendPing, 20_000)
  }
})
// Something seen (left the page, pasted…): the board hears of it at once, not at the next beat.
let soon: ReturnType<typeof setTimeout> | undefined
watch(() => ({ ...integrity.signals }), () => {
  if (!atSeat.value || !begun.value) return
  clearTimeout(soon)
  soon = setTimeout(sendPing, 1000)
})
onBeforeUnmount(() => {
  clearInterval(pinger)
  clearTimeout(soon)
})
usePreventLeave(() => !!section.value && !submitting.value && !practice.value && (Object.keys(answers.value).length > 0 || Object.values(essays.value).some(t => !!t?.trim())))

async function handIn(extra: { recordings?: { partId: string, position: number, audioRef: string, durationSeconds?: number }[] } = {}) {
  submitting.value = true
  try {
    const result = await $fetch<any>(`/api/tests/${slug}/${skill.toLowerCase()}/submit${partQuery}`, {
      method: 'POST',
      body: {
        answers: answersPayload(answers.value, parts.value),
        essays: Object.entries(essays.value).map(([taskId, text]) => ({ taskId, text: text ?? '' })),
        recordings: extra.recordings ?? [],
        startedAt: startedAt.value,
        ...(atSeat.value ? { integrity: integrity.signals } : {})
      }
    })
    forget()
    // At a seat: back to the seat screen for the next section (no result while it may be held).
    if (atSeat.value) return router.replace('/seat')
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
    toast.add({ title: t('sit.notHandedIn'), description: e?.data?.message || e?.message || t('sit.notHandedInText'), color: 'error' })
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

/** A signed-in candidate's answers go to storage one by one while the exam goes on. */
const uploadAnswer = (blob: Blob, step: { partId: string, position: number }) =>
  uploadFile(new File([blob], `speaking-${step.partId}-${step.position + 1}.webm`, { type: blob.type || 'audio/webm' }), { purpose: 'recording' }).then(f => f.url)

async function finishSpeaking(list: SpeakingRecording[]) {
  recordings.value = list
  if (!canBeMarked.value) {
    practice.value = 'SPEAKING'
    return
  }
  submitting.value = true
  try {
    // Waits for the uploads still under way; one that failed is tried once more.
    const uploaded = await Promise.all(list.map(async (r) => {
      const stored = (await r.audioRef) ?? await uploadAnswer(r.blob, r)
      r.audioRef = Promise.resolve(stored)
      return { partId: r.partId, position: r.position, audioRef: stored, durationSeconds: r.durationSeconds }
    }))
    await handIn({ recordings: uploaded })
  } catch (e: any) {
    toast.add({ title: t('sit.recordingsNotSent'), description: e?.message || t('common.tryAgain'), color: 'error' })
    submitting.value = false
  }
}

/** The question an answer was to (Part 1.1 and 1.2), for the list of recordings. */
const answerLabel = (r: { partId: string, position: number }) => {
  const p = section.value?.speaking?.find(x => x.id === r.partId)
  return p && answeredByQuestion(p.partNumber, p.exam) ? p.questions?.[r.position]?.text ?? '' : ''
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
    toast.add({ title: t('sit.fileFailed'), description: e?.message, color: 'error' })
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

const leaveTo = computed(() => (atSeat.value || route.query.seat ? '/seat' : `/tests/${slug}`))
// A premium test without Premium: the paper is not sent, the offer is shown instead.
const premiumNeeded = ref(false)
watch(error, (e) => {
  if (e?.statusCode === 402) premiumNeeded.value = true
}, { immediate: true })
const practiceNote = computed(() => (loggedIn.value
  ? t('sit.practiceNote')
  : t('sit.practiceNoteGuest')))

const pageError = computed(() => {
  if (premiumNeeded.value) return null
  if (error.value) return error.value.statusCode === 404 ? t('sit.notAvailable') : error.value.statusCode === 403 || error.value.statusCode === 409 ? (error.value.data?.message || t('sit.couldNotOpen')) : t('sit.couldNotOpen')
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
        :label="t('sit.backToTest')"
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
    :back-label="t('sit.backToTest')"
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
          <p>{{ t('sit.handingIn') }}</p>
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
            :title="t('sit.writingFinished')"
            :description="`${t('sit.writingFinishedText')} ${practiceNote}`"
            variant="naked"
          />
          <template v-if="loggedIn">
            <UButton
              v-if="canBeMarked"
              :label="t('sit.handIn')"
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
              :label="t('sit.downloadPdf')"
              icon="i-lucide-file-down"
              :loading="downloading === 'pdf'"
              @click="download('pdf')"
            />
            <UButton
              :label="t('sit.downloadWord')"
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
                  :label="t('common.words', { n: e.wordCount }, e.wordCount)"
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
              {{ t('sit.notWritten') }}
            </p>
          </UCard>
          <div class="flex flex-wrap justify-center gap-2">
            <UButton
              v-if="!loggedIn"
              :to="`/login?next=${encodeURIComponent(route.fullPath)}`"
              :label="t('sit.signInToMark')"
              icon="i-lucide-log-in"
              color="neutral"
              variant="outline"
            />
            <UButton
              :label="t('sit.writeAgain')"
              icon="i-lucide-rotate-ccw"
              color="neutral"
              variant="ghost"
              @click="startOver"
            />
            <UButton
              :to="leaveTo"
              :label="t('sit.backToTest')"
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
            :title="t('sit.speakingFinished')"
            :description="`${t('sit.speakingFinishedText')} ${practiceNote}`"
            variant="naked"
          />
          <template v-if="loggedIn">
            <UButton
              v-if="canBeMarked"
              :label="t('sit.handIn')"
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
            :key="`${r.partId}:${r.position}`"
          >
            <p
              v-if="answerLabel(r)"
              class="text-sm text-toned mb-2"
            >
              {{ answerLabel(r) }}
            </p>
            <div class="flex flex-wrap items-center gap-3">
              <span class="font-medium">{{ speakingPartLabel(section?.speaking?.find(p => p.id === r.partId)?.partNumber) }}</span>
              <audio
                :src="r.url"
                controls
                class="flex-1 min-w-52"
              />
              <UButton
                :href="r.url"
                :download="`speaking-${speakingPartLabel(section?.speaking?.find(p => p.id === r.partId)?.partNumber)}-${r.position + 1}.webm`"
                icon="i-lucide-download"
                color="neutral"
                variant="outline"
                :aria-label="t('sit.download')"
              />
            </div>
          </UCard>
          <div class="flex flex-wrap justify-center gap-2">
            <UButton
              v-if="!loggedIn"
              :to="`/login?next=${encodeURIComponent(route.fullPath)}`"
              :label="t('sit.signInToMark')"
              icon="i-lucide-log-in"
              color="neutral"
              variant="outline"
            />
            <UButton
              :label="t('common.tryAgain')"
              icon="i-lucide-rotate-ccw"
              color="neutral"
              variant="ghost"
              @click="startOver"
            />
            <UButton
              :to="leaveTo"
              :label="t('sit.backToTest')"
              color="neutral"
              variant="ghost"
            />
          </div>
        </div>
      </div>

      <template v-else-if="section">
        <IxListeningExam
          v-if="ielts && skill === 'LISTENING'"
          :parts="parts"
          :audio-url="mediaUrl(section.audioUrl) || undefined"
          :part-audio-urls="partAudio"
          :initial-answers="answers"
          :leave-to="leaveTo"
          @start="begun = true"
          @save-progress="onAnswers"
          @submit="finishObjective"
        />
        <IxReadingExam
          v-else-if="ielts && skill === 'READING'"
          :parts="parts"
          :timer-seconds="seconds"
          :initial-answers="answers"
          :leave-to="leaveTo"
          :auto-start="resumed"
          @start="begun = true"
          @save-progress="onAnswers"
          @submit="finishObjective"
        />
        <IxWritingExam
          v-else-if="ielts && skill === 'WRITING'"
          :parts="writingParts"
          :timer-seconds="seconds"
          :initial-essays="essays"
          :leave-to="leaveTo"
          :auto-start="resumed"
          @start="begun = true"
          @save-progress="onEssays"
          @submit="finishWriting"
        />
        <ExamListeningExam
          v-else-if="skill === 'LISTENING'"
          :parts="parts"
          :audio-url="mediaUrl(section.audioUrl) || undefined"
          :part-audio-urls="partAudio"
          :initial-answers="answers"
          :leave-to="leaveTo"
          @start="begun = true"
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
          @start="begun = true"
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
          @start="begun = true"
          @save-progress="onEssays"
          @submit="finishWriting"
        />
        <ExamSpeakingExam
          v-else
          :parts="section.speaking ?? []"
          :leave-to="leaveTo"
          :upload="loggedIn ? uploadAnswer : undefined"
          @submit="finishSpeaking"
        />
      </template>
    </div>
  </ExamLoadState>
</template>
