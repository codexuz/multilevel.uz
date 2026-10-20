<script setup lang="ts">
import type { AnswerMap, PartData } from '~/types/exam'

const props = withDefaults(defineProps<{
  parts: PartData[]
  timerMinutes?: number
  /** Time left on the server's clock, when the attempt is timed there. */
  timerSeconds?: number | null
  /** Answers already saved, when coming back to an attempt. */
  initialAnswers?: AnswerMap
  autoStart?: boolean
  leaveTo?: string
}>(), { timerMinutes: 60, timerSeconds: null, initialAnswers: () => ({}) })

const emit = defineEmits<{
  start: []
  submit: [answers: AnswerMap]
  saveProgress: [answers: AnswerMap]
}>()

const session = useExamSession(() => props.parts, props.autoStart)
session.answers.value = { ...props.initialAnswers }
const notesOpen = ref(false)
const notes = ref('')
// On a phone one pane shows at a time; picking a question in the navigator shows the questions.
const pane = ref(0)
watch(() => session.currentQuestion.value, () => (pane.value = 1))

// Every answer, and every move between parts, goes to the page to be kept.
watch([session.answers, session.currentPart], () => {
  if (session.started.value && !session.submitted.value) emit('saveProgress', session.answers.value)
})

function start() {
  session.start()
  emit('start')
}

function submit() {
  if (session.submitted.value) return
  session.finish()
  emit('submit', session.answers.value)
}
</script>

<template>
  <ExamShell v-if="session.part.value">
    <ExamHeader
      :initial-seconds="timerSeconds ?? timerMinutes * 60"
      :running="session.running.value"
      :started="session.started.value"
      :leave-to="leaveTo"
      @start="start"
      @time-up="submit"
      @submit="submit"
      @notes="notesOpen = true"
    />

    <ExamPartHeader
      :label="session.part.value.partLabel"
      :instruction="session.part.value.instruction"
    />

    <ExamPanes
      v-model:pane="pane"
      :labels="['Passage', 'Questions']"
    >
      <template #first>
        <ExamHighlightablePanel>
          <div class="h-full overflow-y-auto px-4 md:px-6 py-4 bg-default">
            <p
              v-if="session.part.value.title"
              class="text-lg font-bold mb-4 text-highlighted"
            >
              {{ session.part.value.title }}
            </p>
            <div
              v-if="session.part.value.content"
              class="rich-content reading-passage leading-7"
              v-html="session.part.value.content"
            />
            <UEmpty
              v-else
              icon="i-lucide-file-x"
              title="No passage content available"
              variant="naked"
            />
          </div>
        </ExamHighlightablePanel>
      </template>
      <template #second>
        <ExamHighlightablePanel>
          <ExamQuestionPanel
            :questions="session.part.value.questions"
            :answers="session.answers.value"
            :disabled="!session.started.value || session.submitted.value"
            :show-results="session.submitted.value"
            @answer="session.answer"
          />
        </ExamHighlightablePanel>
      </template>
    </ExamPanes>

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
