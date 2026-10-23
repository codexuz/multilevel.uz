<script setup lang="ts">
import type { AnswerMap, PartData } from '~/types/exam'

/**
 * The Listening section as the computer-delivered IELTS runs it: a dark cover with the headphones
 * and Play, then the recording plays through once ("Audio is Playing" under the candidate's name)
 * while the questions of each part are answered in one column; when it ends, the review time runs.
 */
const props = withDefaults(defineProps<{
  parts: PartData[]
  reviewMinutes?: number
  audioUrl?: string
  partAudioUrls?: Record<number, string>
  /** Answers already saved, when coming back to an attempt. */
  initialAnswers?: AnswerMap
  leaveTo?: string
  /**
   * The recording has already played in this attempt (a mock reopened after a crash or a move to
   * another computer): no Play, no audio, straight back to the questions on the time left.
   */
  noReplay?: boolean
  /** Time left on the server's clock, for a paper that carries on without its recording. */
  resumeSeconds?: number | null
  /** The last section of the paper: its submission page hands the whole test in. */
  last?: boolean
}>(), { reviewMinutes: 2, initialAnswers: () => ({}), last: true })

const emit = defineEmits<{
  start: []
  submit: [answers: AnswerMap]
  saveProgress: [answers: AnswerMap]
  /** The recording began: the page records it, so it is never played twice. */
  audioStarted: []
}>()

provideIxTheme()
const chrome = provideIxChrome()
const session = useIxSession(() => props.parts)
session.answers.value = { ...props.initialAnswers }
session.running.value = false

watchEffect(() => (chrome.partLabel.value = session.part.value?.partLabel ?? ''))

const showCover = ref(!props.noReplay)
const timerSeconds = ref(props.noReplay ? Math.max(0, props.resumeSeconds ?? props.reviewMinutes * 60) : props.reviewMinutes * 60)
if (props.noReplay) {
  session.started.value = true
  session.running.value = true
}
// The full recording, or each part's in turn with the paper following it; then review time.
const playback = useListeningPlayback({
  fullUrl: () => props.audioUrl,
  partUrls: () => props.partAudioUrls,
  partCount: () => props.parts.length,
  onPart: i => session.setPart(i),
  done: startReview
})
const audioPlaying = playback.playing

// Every answer, and every move between parts, goes to the page to be kept.
watch([session.answers, session.currentPart], () => {
  if (session.started.value && !session.submitted.value) emit('saveProgress', session.answers.value)
})
watch(session.currentPart, () => nextTick(() => document.querySelector('.ix-single')?.scrollTo({ top: 0 })))

function startReview() {
  timerSeconds.value = props.reviewMinutes * 60
  session.running.value = true
}

function playAudio() {
  if (playback.start()) emit('audioStarted')
}

function begin() {
  showCover.value = false
  session.started.value = true
  playAudio()
  emit('start')
}

function submit() {
  if (session.submitted.value) return
  playback.stop()
  session.finish()
  emit('submit', session.answers.value)
}

function toPart(i: number) {
  chrome.submissionOpen.value = false
  session.setPart(i)
}
function toQuestion(n: number) {
  chrome.submissionOpen.value = false
  session.goToQuestion(n)
}
function next() {
  if (session.atEnd.value) chrome.submissionOpen.value = true
  else session.next()
}

const status = computed(() => {
  if (audioPlaying.value) return { text: 'Audio is Playing', icon: 'i-lucide-volume-2' }
  if (props.noReplay) return { text: 'Recording already played', icon: 'i-lucide-volume-x' }
  if (session.running.value) return { text: 'Review time', icon: 'i-lucide-hourglass' }
  return null
})

const summary = computed(() => props.parts.map((p) => {
  const nums = getAllQuestionNumbers(p.questions)
  const missing = nums.filter(n => !session.answers.value[n])
  return { label: p.partLabel, answered: nums.length - missing.length, total: nums.length, missing }
}))
</script>

<template>
  <IxShell v-if="session.part.value">
    <IxHeader
      :initial-seconds="timerSeconds"
      :running="session.running.value"
      :started="session.running.value"
      :leave-to="leaveTo"
      :status="status?.text"
      :status-icon="status?.icon"
      @time-up="submit"
    />

    <IxPartHeader v-if="!chrome.submissionOpen.value" :label="session.part.value.partLabel" :instruction="session.part.value.instruction" />

    <div class="ix-body">
      <IxSubmissionPage v-if="chrome.submissionOpen.value" :parts="summary" :last="last" @submit="submit" />
      <div v-else class="ix-single">
        <IxHighlightablePanel>
          <IxQuestionPanel
            :questions="session.part.value.questions"
            :answers="session.answers.value"
            :disabled="!session.started.value || session.submitted.value"
            :show-results="session.submitted.value"
            :current-question="session.currentQuestion.value"
            @answer="session.answer"
            @focus="session.focusQuestion"
          />
        </IxHighlightablePanel>
      </div>
      <IxStartCover v-if="showCover" listening @go="begin" />
    </div>

    <IxPartNavigator
      :parts="parts"
      :current-part="session.currentPart.value"
      :current-question="session.currentQuestion.value"
      :answers="session.answers.value"
      :can-prev="!session.atStart.value && !chrome.submissionOpen.value"
      :can-next="!chrome.submissionOpen.value"
      :submitting="chrome.submissionOpen.value"
      @update:current-part="toPart"
      @question="toQuestion"
      @prev="session.prev"
      @next="next"
      @deliver="chrome.submissionOpen.value = true"
    />
  </IxShell>
</template>
