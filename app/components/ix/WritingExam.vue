<script setup lang="ts">
import type { WritingPartData } from '~/utils/exam-transform'

/**
 * The Writing section as the computer-delivered IELTS lays it out: the task on the left, the answer
 * box on the right with its word count under it, each task a part in the bar at the bottom.
 */
const props = withDefaults(defineProps<{
  parts: WritingPartData[]
  timerMinutes?: number
  /** Time left on the server's clock, when the attempt is timed there. */
  timerSeconds?: number | null
  /** Essays already saved, keyed by task id. */
  initialEssays?: Record<string, string>
  autoStart?: boolean
  leaveTo?: string
  /** The last section of the paper: its submission page hands the whole test in. */
  last?: boolean
}>(), { timerMinutes: 60, timerSeconds: null, initialEssays: () => ({}), last: true })

const emit = defineEmits<{
  start: []
  submit: [essays: Record<string, string>]
  saveProgress: [essays: Record<string, string>]
}>()

provideIxTheme()
const chrome = provideIxChrome()
const current = ref(0)
const essays = ref<Record<string, string>>({ ...props.initialEssays })
const started = ref(props.autoStart)
const running = ref(props.autoStart)
const submitted = ref(false)

const part = computed(() => props.parts[current.value])
const label = (i: number) => `Part ${i + 1}`
const wordCount = computed(() => countWords(essays.value[part.value?.id ?? ''] ?? ''))
watchEffect(() => (chrome.partLabel.value = label(current.value)))

// Every keystroke goes to the page to be kept (it decides how often to send).
watch([essays, current], () => {
  if (started.value && !submitted.value) emit('saveProgress', essays.value)
})

function setEssay(text: string) {
  if (!part.value) return
  essays.value = { ...essays.value, [part.value.id]: text }
}

function start() {
  started.value = true
  running.value = true
  emit('start')
}

function submit() {
  if (submitted.value) return
  running.value = false
  submitted.value = true
  emit('submit', essays.value)
}

function toPart(i: number) {
  chrome.submissionOpen.value = false
  current.value = i
}
function next() {
  if (current.value >= props.parts.length - 1) chrome.submissionOpen.value = true
  else current.value++
}

const navParts = computed(() => props.parts.map((p, i) => ({ id: p.id, partLabel: label(i), totalQuestions: 1, answered: !!essays.value[p.id]?.trim() })))
const summary = computed(() => navParts.value.map(p => ({ label: p.partLabel, answered: p.answered ? 1 : 0, total: 1 })))

const subtitle = computed(() => [
  part.value?.suggested_time ? `You should spend about ${part.value.suggested_time} minutes on this task.` : '',
  part.value?.min_words ? `Write at least ${part.value.min_words} words.` : ''
].filter(Boolean).join(' '))
</script>

<template>
  <IxShell v-if="part">
    <IxHeader
      :initial-seconds="timerSeconds ?? timerMinutes * 60"
      :running="running"
      :started="started"
      :leave-to="leaveTo"
      @time-up="submit"
    />

    <IxPartHeader v-if="!chrome.submissionOpen.value" :label="label(current)" :instruction="subtitle" />

    <div class="ix-body">
      <IxSubmissionPage v-if="chrome.submissionOpen.value" :parts="summary" :last="last" @submit="submit" />
      <IxSplitPane v-else>
        <template #left>
          <IxHighlightablePanel>
            <div v-if="part.prompt" class="ix-task" v-html="part.prompt" />
            <img v-if="part.image_url" :src="part.image_url" alt="Task image" class="ix-image">
          </IxHighlightablePanel>
        </template>
        <template #right>
          <textarea
            :key="part.id"
            class="ix-essay"
            :value="essays[part.id] ?? ''"
            :disabled="!started || submitted"
            :aria-label="`${label(current)} answer`"
            spellcheck="false"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            data-testid="essay"
            @input="setEssay(($event.target as HTMLTextAreaElement).value)"
          />
          <p class="ix-words" data-testid="word-count">
            Words: {{ wordCount }}
          </p>
        </template>
      </IxSplitPane>
      <IxStartCover v-if="!started" :text="`This is the Writing test. It has ${parts.length} ${parts.length === 1 ? 'part' : 'parts'}.`" @go="start" />
    </div>

    <IxPartNavigator
      :parts="navParts"
      :current-part="current"
      :can-prev="current > 0 && !chrome.submissionOpen.value"
      :can-next="!chrome.submissionOpen.value"
      :submitting="chrome.submissionOpen.value"
      @update:current-part="toPart"
      @prev="current = Math.max(0, current - 1)"
      @next="next"
      @deliver="chrome.submissionOpen.value = true"
    />
  </IxShell>
</template>
