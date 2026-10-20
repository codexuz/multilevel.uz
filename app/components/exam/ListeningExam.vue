<script setup lang="ts">
import type { AnswerMap, PartData } from '~/types/exam'

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
}>(), { reviewMinutes: 2, initialAnswers: () => ({}) })

const emit = defineEmits<{
  start: []
  submit: [answers: AnswerMap]
  saveProgress: [answers: AnswerMap]
  /** The recording began: the page records it, so it is never played twice. */
  audioStarted: []
}>()

const session = useExamSession(() => props.parts)
session.answers.value = { ...props.initialAnswers }
session.running.value = false

const showOverlay = ref(!props.noReplay)
const audioPlaying = ref(false)
const timerSeconds = ref(props.noReplay ? Math.max(0, props.resumeSeconds ?? props.reviewMinutes * 60) : props.reviewMinutes * 60)
if (props.noReplay) {
  session.started.value = true
  session.running.value = true
}
const notesOpen = ref(false)
const notes = ref('')
let audio: HTMLAudioElement | null = null

onBeforeUnmount(() => {
  audio?.pause()
  audio = null
})

// Every answer, and every move between parts, goes to the page to be kept.
watch([session.answers, session.currentPart], () => {
  if (session.started.value && !session.submitted.value) emit('saveProgress', session.answers.value)
})

function currentAudioUrl() {
  return props.audioUrl || props.partAudioUrls?.[session.currentPart.value] || null
}

function startReview() {
  audioPlaying.value = false
  timerSeconds.value = props.reviewMinutes * 60
  session.running.value = true
}

function playAudio() {
  const url = currentAudioUrl()
  if (!url) return startReview()
  audio?.pause()
  audio = new Audio(url)
  audioPlaying.value = true
  audio.addEventListener('ended', startReview)
  audio.play().catch(console.error)
  emit('audioStarted')
}

function begin(emitStart: boolean) {
  showOverlay.value = false
  session.started.value = true
  playAudio()
  if (emitStart) emit('start')
}

function submit() {
  if (session.submitted.value) return
  audio?.pause()
  session.finish()
  emit('submit', session.answers.value)
}
</script>

<template>
  <ExamShell v-if="session.part.value">
    <UModal
      :open="showOverlay"
      :dismissible="false"
      :close="false"
      :ui="{ content: 'max-w-md', overlay: 'bg-black/70' }"
    >
      <template #content>
        <UEmpty
          icon="i-lucide-headphones"
          title="You will be listening to an audio clip during this test."
          description="Make sure your speakers or headphones are working properly. To continue, click Play."
          size="lg"
          :actions="[{ label: 'Play', icon: 'i-lucide-play', color: 'error', size: 'lg', class: 'px-8', onClick: () => begin(true) }]"
          class="py-10"
        />
      </template>
    </UModal>

    <ExamHeader
      :initial-seconds="timerSeconds"
      :running="session.running.value"
      :started="session.started.value"
      :leave-to="leaveTo"
      @start="begin(false)"
      @time-up="submit"
      @submit="submit"
      @notes="notesOpen = true"
    />

    <ExamPartHeader
      :label="session.part.value.partLabel"
      :instruction="session.part.value.instruction"
    >
      <template #badges>
        <UBadge
          v-if="noReplay"
          icon="i-lucide-volume-x"
          label="Recording already played"
          color="neutral"
          variant="subtle"
          size="sm"
          class="rounded-full"
          data-testid="no-replay"
        />
        <UBadge
          v-if="audioPlaying"
          icon="i-lucide-volume-2"
          label="Audio playing"
          color="error"
          variant="subtle"
          size="sm"
          class="rounded-full"
        />
        <UBadge
          v-else-if="session.running.value"
          icon="i-lucide-hourglass"
          label="Review time"
          color="warning"
          variant="subtle"
          size="sm"
          class="rounded-full"
        />
      </template>
    </ExamPartHeader>

    <div class="flex-1 min-h-0 overflow-hidden flex justify-center py-2 md:py-6">
      <div class="w-full lg:w-4/5 h-full">
        <ExamHighlightablePanel>
          <ExamQuestionPanel
            :questions="session.part.value.questions"
            :answers="session.answers.value"
            :disabled="!session.started.value || session.submitted.value"
            :show-results="session.submitted.value"
            class="lg:rounded-lg lg:border lg:border-default"
            @answer="session.answer"
          />
        </ExamHighlightablePanel>
      </div>
    </div>

    <ExamPartNavigator
      :parts="parts"
      :current-part="session.currentPart.value"
      :current-question="session.currentQuestion.value"
      :answers="session.answers.value"
      @update:current-part="session.setPart"
      @question="session.goToQuestion"
      @prev="session.prev"
      @next="session.next"
    />

    <ExamNotesSlideover
      v-model:open="notesOpen"
      v-model="notes"
      title="Notes"
    />
  </ExamShell>
</template>
