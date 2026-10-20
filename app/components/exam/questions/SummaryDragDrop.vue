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

const rawHtml = computed(() => props.question.questionText ?? '')
const inline = computed(() => /_{2,}|\.{3,}/.test(rawHtml.value))
const segments = computed(() => rawHtml.value
  .replace(/<\/p>\s*<p>/gi, '<br/><br/>')
  .replace(/<\/?p>/gi, '')
  .split(/_{2,}/))

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

    <div
      v-if="inline"
      class="rich-content leading-[2.4] mb-6"
    >
      <template
        v-for="(frag, i) in segments"
        :key="i"
      >
        <span v-html="frag" />
        <template v-if="i < segments.length - 1 && subs[i]">
          <UButton
            :id="`question-${subs[i]!.questionNumber}`"
            :label="answers[subs[i]!.questionNumber ?? 0] ? textFor(answers[subs[i]!.questionNumber ?? 0]!) : String(subs[i]!.questionNumber)"
            :color="gapColor(subs[i]!)"
            :variant="answers[subs[i]!.questionNumber ?? 0] ? 'soft' : 'outline'"
            size="sm"
            class="min-w-36 justify-center border-dashed mx-1 align-middle"
            @click="clickGap(subs[i]!.questionNumber ?? 0)"
            @dragover.prevent="overGap = subs[i]!.questionNumber ?? 0"
            @dragleave="overGap = null"
            @drop.prevent="onDrop(subs[i]!.questionNumber ?? 0, $event)"
          />
          <UBadge
            v-if="showResults && answers[subs[i]!.questionNumber ?? 0] && answers[subs[i]!.questionNumber ?? 0] !== subs[i]!.correctAnswer"
            :label="`${subs[i]!.correctAnswer}. ${textFor(subs[i]!.correctAnswer ?? '')}`"
            color="success"
            variant="subtle"
            size="sm"
          />
        </template>
      </template>
    </div>

    <div
      v-else
      class="space-y-3 mb-6"
    >
      <div
        v-for="sub in subs"
        :key="sub.questionNumber"
        class="flex flex-wrap items-center gap-2 leading-loose"
      >
        <span>{{ sub.questionText }}</span>
        <UButton
          :id="`question-${sub.questionNumber}`"
          :label="answers[sub.questionNumber ?? 0] ? textFor(answers[sub.questionNumber ?? 0]!) : String(sub.questionNumber)"
          :color="gapColor(sub)"
          :variant="answers[sub.questionNumber ?? 0] ? 'soft' : 'outline'"
          size="sm"
          class="min-w-36 justify-center border-dashed"
          @click="clickGap(sub.questionNumber ?? 0)"
          @dragover.prevent="overGap = sub.questionNumber ?? 0"
          @dragleave="overGap = null"
          @drop.prevent="onDrop(sub.questionNumber ?? 0, $event)"
        />
        <UBadge
          v-if="showResults && answers[sub.questionNumber ?? 0] && answers[sub.questionNumber ?? 0] !== sub.correctAnswer"
          :label="`Correct: ${sub.correctAnswer}. ${textFor(sub.correctAnswer ?? '')}`"
          color="success"
          variant="subtle"
          size="sm"
        />
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
