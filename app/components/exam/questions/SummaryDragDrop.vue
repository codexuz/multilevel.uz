<script setup lang="ts">
import type { IELTSSubQuestion } from '~/types/ielts'
import type { QuestionEmits, QuestionProps } from '~/types/question-props'

const props = defineProps<QuestionProps>()
const emit = defineEmits<QuestionEmits>()

const subs = computed(() => props.question.questions ?? [])
const bank = computed(() => props.question.options ?? [])
const ownNums = computed(() => new Set(subs.value.map(s => s.questionNumber ?? 0)))
const placed = computed(() => new Set(subs.value.map(s => props.answers[s.questionNumber ?? 0]).filter(Boolean)))
const textFor = (key: string) => bank.value.find(o => o.optionKey === key)?.optionText ?? key

// The summary's text with its gaps ("___" or "{n}") where they stand, else each question's sentence.
const lines = computed(() => gapPieces(props.question.questionText ?? '', subs.value)
  .map(line => line.map(p => (p.html !== undefined ? { html: p.html } : { sub: subs.value.find(s => s.questionNumber === p.n) }))))

const picked = ref<string | null>(null)
const dragging = ref<string | null>(null)
const overGap = ref<number | null>(null)

function place(n: number, key: string) {
  if (props.disabled) return
  for (const num of ownNums.value) {
    if (num !== n && props.answers[num] === key) emit('answer', num, '')
  }
  emit('answer', n, key)
  picked.value = null
}

function clickGap(n: number) {
  if (props.disabled) return
  if (picked.value) place(n, picked.value)
  else if (props.answers[n]) emit('answer', n, '')
}

function onDrop(n: number, e: DragEvent) {
  overGap.value = null
  const key = e.dataTransfer?.getData('text/plain') || dragging.value
  if (key) place(n, key)
  dragging.value = null
}

function gapColor(sub: IELTSSubQuestion) {
  const n = sub.questionNumber ?? 0
  const value = props.answers[n]
  if (overGap.value === n) return 'primary'
  if (props.showResults && value) return value === sub.correctAnswer ? 'success' : 'error'
  return value ? 'primary' : 'neutral'
}
</script>

<template>
  <div>
    <ExamQuestionsHeading :question="question" />

    <div class="space-y-3 mb-6">
      <div
        v-for="(line, li) in lines"
        :key="li"
        class="rich-content leading-[2.4]"
      >
        <template
          v-for="(piece, pi) in line"
          :key="pi"
        >
          <span
            v-if="'html' in piece"
            v-html="piece.html"
          />
          <template v-else-if="piece.sub">
            <UButton
              :id="`question-${piece.sub.questionNumber}`"
              :label="answers[piece.sub.questionNumber ?? 0] ? textFor(answers[piece.sub.questionNumber ?? 0]!) : String(piece.sub.questionNumber)"
              :color="gapColor(piece.sub)"
              :variant="answers[piece.sub.questionNumber ?? 0] ? 'soft' : 'outline'"
              size="sm"
              class="min-w-36 justify-center border-dashed mx-1 align-middle"
              @click="clickGap(piece.sub.questionNumber ?? 0)"
              @dragover.prevent="overGap = piece.sub.questionNumber ?? 0"
              @dragleave="overGap = null"
              @drop.prevent="onDrop(piece.sub.questionNumber ?? 0, $event)"
            />
            <UBadge
              v-if="showResults && answers[piece.sub.questionNumber ?? 0] && answers[piece.sub.questionNumber ?? 0] !== piece.sub.correctAnswer"
              :label="`${piece.sub.correctAnswer}. ${textFor(piece.sub.correctAnswer ?? '')}`"
              color="success"
              variant="subtle"
              size="sm"
            />
          </template>
          <span v-else>______</span>
        </template>
      </div>
    </div>

    <UCard
      variant="outline"
      class="border-dashed"
      :ui="{ body: 'grid grid-cols-2 md:grid-cols-3 gap-2 p-3 sm:p-4' }"
    >
      <UButton
        v-for="item in bank"
        :key="item.optionKey"
        :label="`${item.optionKey}. ${item.optionText}`"
        :color="picked === item.optionKey ? 'primary' : 'neutral'"
        :variant="picked === item.optionKey ? 'solid' : 'outline'"
        :disabled="disabled || placed.has(item.optionKey)"
        :draggable="!disabled && !placed.has(item.optionKey)"
        class="justify-center whitespace-normal cursor-grab"
        @click="() => { picked = picked === item.optionKey ? null : item.optionKey }"
        @dragstart="(e: DragEvent) => { dragging = item.optionKey; e.dataTransfer?.setData('text/plain', item.optionKey) }"
        @dragend="dragging = null"
      />
    </UCard>
    <p
      v-if="!disabled"
      class="text-xs text-muted mt-2"
    >
      Drag a word into a gap, or tap a word and then tap a gap. Tap a filled gap to clear it.
    </p>
  </div>
</template>
