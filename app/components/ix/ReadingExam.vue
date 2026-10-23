<script setup lang="ts">
import type { AnswerMap, PartData } from '~/types/exam'

/**
 * The Reading section as the computer-delivered IELTS lays it out: the passage on the left, the
 * questions on the right with the ⟷ handle between, the parts and their questions in the bar at the
 * bottom, and the submission page behind the ✓.
 */
const props = withDefaults(defineProps<{
  parts: PartData[]
  timerMinutes?: number
  /** Time left on the server's clock, when the attempt is timed there. */
  timerSeconds?: number | null
  /** Answers already saved, when coming back to an attempt. */
  initialAnswers?: AnswerMap
  autoStart?: boolean
  leaveTo?: string
  /** The last section of the paper: its submission page hands the whole test in. */
  last?: boolean
}>(), { timerMinutes: 60, timerSeconds: null, initialAnswers: () => ({}), last: true })

const emit = defineEmits<{
  start: []
  submit: [answers: AnswerMap]
  saveProgress: [answers: AnswerMap]
}>()

provideIxTheme()
const chrome = provideIxChrome()
const session = useIxSession(() => props.parts, props.autoStart)
session.answers.value = { ...props.initialAnswers }

watchEffect(() => (chrome.partLabel.value = session.part.value?.partLabel ?? ''))

// Every answer, and every move between parts, goes to the page to be kept.
watch([session.answers, session.currentPart], () => {
  if (session.started.value && !session.submitted.value) emit('saveProgress', session.answers.value)
})

// A new part starts at the top of its passage and questions.
watch(session.currentPart, () => nextTick(() => document.querySelectorAll('.ix-pane').forEach(p => p.scrollTo({ top: 0 }))))

function start() {
  session.start()
  emit('start')
}

function submit() {
  if (session.submitted.value) return
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

// The passage, with a gap above each paragraph a matching-headings question is about.
const passage = computed(() => insertHeadingSlots(session.part.value?.content ?? '', session.part.value?.questions ?? []))

const summary = computed(() => props.parts.map((p) => {
  const nums = getAllQuestionNumbers(p.questions)
  const missing = nums.filter(n => !session.answers.value[n])
  return { label: p.partLabel, answered: nums.length - missing.length, total: nums.length, missing }
}))
</script>

<template>
  <IxShell v-if="session.part.value">
    <IxHeader
      :initial-seconds="timerSeconds ?? timerMinutes * 60"
      :running="session.running.value"
      :started="session.started.value"
      :leave-to="leaveTo"
      @time-up="submit"
    />

    <IxPartHeader
      v-if="!chrome.submissionOpen.value"
      :label="session.part.value.partLabel"
      :instruction="session.part.value.instruction"
    />

    <div class="ix-body">
      <IxSubmissionPage v-if="chrome.submissionOpen.value" :parts="summary" :last="last" @submit="submit" />
      <IxSplitPane v-else :labels="['Passage', 'Questions']">
        <template #left>
          <IxHighlightablePanel>
            <div>
              <h2 v-if="session.part.value.title" class="ix-passage-title">
                {{ session.part.value.title }}
              </h2>
              <div v-if="session.part.value.content" class="ix-passage" v-html="passage" />
              <p v-else>
                No passage content available.
              </p>
            </div>
          </IxHighlightablePanel>
        </template>
        <template #right>
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
        </template>
      </IxSplitPane>

      <IxStartCover
        v-if="!session.started.value"
        :text="`This is the Reading test. It has ${parts.length} ${parts.length === 1 ? 'part' : 'parts'} and ${summary.reduce((s, p) => s + p.total, 0)} questions.`"
        @go="start"
      />
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
