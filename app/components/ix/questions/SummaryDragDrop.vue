<script setup lang="ts">
import type { IELTSSubQuestion } from '~/types/ielts'
import type { QuestionEmits, QuestionProps } from '~/types/question-props'

/** A summary with gaps and a box of words to move into them (drag, or click and click). */
const props = defineProps<QuestionProps>()
const emit = defineEmits<QuestionEmits>()
const { focus } = useQuestionFocus()

const subs = computed(() => props.question.questions ?? [])
const bank = computed(() => props.question.options ?? [])
const textFor = (key?: string) => bank.value.find(o => o.optionKey === key)?.optionText ?? key ?? ''

const rawHtml = computed(() => props.question.questionText ?? '')
const inline = computed(() => /_{2,}|\.{3,}/.test(rawHtml.value))
const segments = computed(() => rawHtml.value
  .replace(/<\/p>\s*<p>/gi, '<br/><br/>')
  .replace(/<\/?p>/gi, '')
  .split(/_{2,}/))

const dnd = useTokenDrop({
  nums: () => subs.value.map(s => s.questionNumber ?? 0),
  answers: () => props.answers,
  disabled: () => props.disabled,
  emit: (n, v) => emit('answer', n, v)
})

const review = useReviewMarks()
/** The right answer beside a wrong one: from the marks on a reviewed paper, else from the key in hand. */
function keyText(sub: IELTSSubQuestion) {
  const n = sub.questionNumber ?? 0
  if (review.marks) return review.keyFor(n).map(textFor).join(' / ')
  return props.showResults && props.answers[n] !== sub.correctAnswer && sub.correctAnswer ? textFor(sub.correctAnswer) : ''
}

function state(sub: IELTSSubQuestion) {
  if (review.marks) return review.gapState(sub.questionNumber ?? 0)
  const v = props.answers[sub.questionNumber ?? 0]
  if (props.showResults && (v || sub.correctAnswer)) return v === sub.correctAnswer ? 'is-correct' : 'is-wrong'
  return ''
}
</script>

<template>
  <div>
    <IxQuestionsHeading :question="question" />

    <div :class="inline ? 'ix-gapline' : ''">
      <template v-for="(sub, i) in subs" :key="sub.questionNumber">
        <span v-if="inline" v-html="segments[i]" />
        <div v-else class="ix-gapline" style="display: inline">
          {{ sub.questionText }}
        </div>
        <span
          :id="`question-${sub.questionNumber}`"
          class="ix-drop"
          :class="[state(sub), { 'is-filled': !!answers[sub.questionNumber ?? 0], 'is-over': dnd.over.value === sub.questionNumber }]"
          tabindex="0"
          role="button"
          :aria-label="`Question ${sub.questionNumber}: ${answers[sub.questionNumber ?? 0] ? textFor(answers[sub.questionNumber ?? 0]) : 'empty'}`"
          :draggable="!disabled && !!answers[sub.questionNumber ?? 0]"
          @focus="focus(sub.questionNumber ?? 0)"
          @click="dnd.clickGap(sub.questionNumber ?? 0)"
          @keydown.enter.prevent="dnd.clickGap(sub.questionNumber ?? 0)"
          @dragstart="dnd.dragToken(answers[sub.questionNumber ?? 0]!, $event, sub.questionNumber ?? 0)"
          @dragover.prevent="dnd.over.value = sub.questionNumber ?? 0"
          @dragleave="dnd.over.value = null"
          @drop.prevent="dnd.dropOnGap(sub.questionNumber ?? 0, $event)"
        >{{ answers[sub.questionNumber ?? 0] ? textFor(answers[sub.questionNumber ?? 0]) : sub.questionNumber }}</span>
        <span v-if="keyText(sub)" class="ix-key">{{ keyText(sub) }}</span>
        <br v-if="!inline">
      </template>
      <span v-if="inline && segments.length > subs.length" v-html="segments[segments.length - 1]" />
    </div>

    <div
      class="ix-tokens is-inline"
      style="margin-top: 20px"
      @dragover.prevent="dnd.over.value = 'list'"
      @dragleave="dnd.over.value = null"
      @drop.prevent="dnd.dropOnList($event)"
    >
      <button
        v-for="item in bank"
        :key="item.optionKey"
        type="button"
        class="ix-token"
        :class="{ 'is-used': dnd.used(item.optionKey), 'is-picked': dnd.picked.value === item.optionKey }"
        :draggable="!disabled"
        :disabled="disabled"
        @click="dnd.clickToken(item.optionKey)"
        @dragstart="dnd.dragToken(item.optionKey, $event)"
      >
        {{ item.optionText }}
      </button>
    </div>
  </div>
</template>
