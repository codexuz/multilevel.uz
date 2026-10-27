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

// The summary's text with its gaps ("___" or "{n}") where they stand, else each question's sentence.
const lines = computed(() => gapPieces(props.question.questionText ?? '', subs.value)
  .map(line => line.map(p => (p.html !== undefined ? { html: p.html } : { sub: subs.value.find(s => s.questionNumber === p.n) }))))

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

    <div v-for="(line, li) in lines" :key="li" class="ix-gapline">
      <template v-for="(piece, pi) in line" :key="pi">
        <span v-if="'html' in piece" v-html="piece.html" />
        <template v-else-if="piece.sub">
          <span
            :id="`question-${piece.sub.questionNumber}`"
            class="ix-drop"
            :class="[state(piece.sub), { 'is-filled': !!answers[piece.sub.questionNumber ?? 0], 'is-over': dnd.over.value === piece.sub.questionNumber }]"
            tabindex="0"
            role="button"
            :aria-label="`Question ${piece.sub.questionNumber}: ${answers[piece.sub.questionNumber ?? 0] ? textFor(answers[piece.sub.questionNumber ?? 0]) : 'empty'}`"
            :draggable="!disabled && !!answers[piece.sub.questionNumber ?? 0]"
            @focus="focus(piece.sub.questionNumber ?? 0)"
            @click="dnd.clickGap(piece.sub.questionNumber ?? 0)"
            @keydown.enter.prevent="dnd.clickGap(piece.sub.questionNumber ?? 0)"
            @dragstart="dnd.dragToken(answers[piece.sub.questionNumber ?? 0]!, $event, piece.sub.questionNumber ?? 0)"
            @dragover.prevent="dnd.over.value = piece.sub.questionNumber ?? 0"
            @dragleave="dnd.over.value = null"
            @drop.prevent="dnd.dropOnGap(piece.sub.questionNumber ?? 0, $event)"
          >{{ answers[piece.sub.questionNumber ?? 0] ? textFor(answers[piece.sub.questionNumber ?? 0]) : piece.sub.questionNumber }}</span>
          <span v-if="keyText(piece.sub)" class="ix-key">{{ keyText(piece.sub) }}</span>
        </template>
        <span v-else>______</span>
      </template>
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
