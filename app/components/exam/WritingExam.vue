<script setup lang="ts">
import type { WritingPartData } from '~/utils/exam-transform'

const props = withDefaults(defineProps<{
  parts: WritingPartData[]
  timerMinutes?: number
  /** Time left on the server's clock, when the attempt is timed there. */
  timerSeconds?: number | null
  /** Essays already saved, keyed by task id. */
  initialEssays?: Record<string, string>
  autoStart?: boolean
  leaveTo?: string
}>(), { timerMinutes: 60, timerSeconds: null, initialEssays: () => ({}) })

const emit = defineEmits<{
  start: []
  submit: [essays: Record<string, string>]
  saveProgress: [essays: Record<string, string>]
}>()

const current = ref(0)
const essays = ref<Record<string, string>>({ ...props.initialEssays })
const started = ref(props.autoStart)
const running = ref(props.autoStart)
const submitted = ref(false)
const notesOpen = ref(false)
const notes = ref('')

const part = computed(() => props.parts[current.value])
const wordCount = computed(() => countWords(essays.value[part.value?.id ?? ''] ?? ''))

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

const subtitle = computed(() => [
  part.value?.suggested_time ? `You should spend about ${part.value.suggested_time} minutes on this task.` : '',
  part.value?.min_words ? `Write at least ${part.value.min_words} words.` : ''
].filter(Boolean).join(' '))
</script>

<template>
  <ExamShell v-if="part">
    <ExamHeader
      :initial-seconds="timerSeconds ?? timerMinutes * 60"
      :running="running"
      :started="started"
      :leave-to="leaveTo"
      @start="start"
      @time-up="submit"
      @submit="submit"
      @notes="notesOpen = true"
    />

    <ExamPartHeader
      :label="part.partLabel"
      :instruction="subtitle"
    />

    <ExamPanes
      :labels="['Task', 'Your answer']"
      :sizes="[40, 60]"
      :min-sizes="[20, 30]"
    >
      <template #first>
        <ExamHighlightablePanel>
          <div class="h-full overflow-y-auto px-4 md:px-6 py-4 bg-default">
            <div
              v-if="part.prompt"
              class="rich-content font-semibold leading-7 mb-6"
              v-html="part.prompt"
            />
            <img
              v-if="part.image_url"
              :src="part.image_url"
              alt="Task image"
              class="max-h-[500px] mx-auto rounded-md"
            >
          </div>
        </ExamHighlightablePanel>
      </template>
      <template #second>
        <div class="h-full w-full flex flex-col px-4 md:px-6 py-4 bg-default">
          <UTextarea
            :model-value="essays[part.id] ?? ''"
            :disabled="!started || submitted"
            :maxrows="0"
            class="flex-1 w-full min-h-64"
            :ui="{ root: 'flex w-full items-stretch', base: 'flex-1 h-full w-full resize-none px-4 py-3 leading-8 text-[0.95em]' }"
            spellcheck="false"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            placeholder="Start writing your answer here…"
            @update:model-value="setEssay(String($event))"
          />
          <div class="flex justify-end mt-2">
            <UBadge
              :label="`Words: ${wordCount}`"
              :color="part.min_words && wordCount >= part.min_words ? 'success' : 'neutral'"
              variant="soft"
            />
          </div>
        </div>
      </template>
    </ExamPanes>

    <ExamPartNavigator
      :parts="parts"
      :current-part="current"
      :can-prev="current > 0"
      :can-next="current < parts.length - 1"
      @update:current-part="current = $event"
      @prev="current = Math.max(0, current - 1)"
      @next="current = Math.min(parts.length - 1, current + 1)"
    />

    <ExamNotesSlideover
      v-model:open="notesOpen"
      v-model="notes"
      title="Notes"
    />
  </ExamShell>
</template>
