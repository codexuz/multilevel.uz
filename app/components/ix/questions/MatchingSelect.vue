<script setup lang="ts">
import type { QuestionEmits, QuestionProps } from '~/types/question-props'

/**
 * Matching headings, features and sentence endings as the computer-delivered IELTS has them: the
 * list of choices, and a gap for each question to move one into (drag, or click and click).
 */
const props = defineProps<QuestionProps & { mode: 'headings' | 'features' | 'endings' }>()
const emit = defineEmits<QuestionEmits>()
const { focus } = useQuestionFocus()

function romanToInt(roman: string) {
  const map: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100 }
  const s = roman.toLowerCase()
  let total = 0
  for (let i = 0; i < s.length; i++) {
    const curr = map[s[i]!] ?? 0
    const next = map[s[i + 1]!] ?? 0
    total += curr < next ? -curr : curr
  }
  return total
}

const entries = computed<[string, string][]>(() => {
  const q = props.question
  if (props.mode === 'headings' && q.headingOptions) {
    return Object.entries(q.headingOptions).sort(([a], [b]) => romanToInt(a) - romanToInt(b))
  }
  return [...(q.options ?? [])].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)).map(o => [o.optionKey, o.optionText])
})
const textFor = (key?: string) => {
  const found = entries.value.find(e => e[0] === key)
  if (!found) return key ?? ''
  return props.mode === 'features' ? `${found[0]}  ${found[1] ?? ''}`.trim() : (found[1] || found[0])
}
const subs = computed(() => props.question.questions ?? [])

const dnd = useTokenDrop({
  nums: () => subs.value.map(s => s.questionNumber ?? 0),
  answers: () => props.answers,
  disabled: () => props.disabled,
  emit: (n, v) => emit('answer', n, v),
  // A feature (a person, a date) may answer several questions.
  reuse: props.mode === 'features'
})

// Heading gaps whose paragraph the passage marks (insertHeadingSlots) are put there.
const slotted = ref(new Set<number>())
function findSlots() {
  if (props.mode !== 'headings' || typeof document === 'undefined') return
  slotted.value = new Set(subs.value.map(s => s.questionNumber ?? 0).filter(n => document.getElementById(`heading-slot-${n}`)))
}
onMounted(findSlots)
watch(() => props.question, () => nextTick(findSlots))

const listTitle = computed(() => ({ headings: 'List of Headings', features: '', endings: 'List of Endings' })[props.mode])

const review = useReviewMarks()
/** The right answer beside a wrong one: from the marks on a reviewed paper, else from the key in hand. */
const keyText = (n: number, correct?: string) => {
  if (review.marks) return review.keyFor(n).map(textFor).join(' / ')
  return props.showResults && props.answers[n] !== correct && correct ? textFor(correct) : ''
}

function state(n: number, correct?: string) {
  if (review.marks) return review.gapState(n)
  const v = props.answers[n]
  if (props.showResults && (v || correct)) return v === correct ? 'is-correct' : 'is-wrong'
  return ''
}
</script>

<template>
  <div>
    <IxQuestionsHeading :question="question" />

    <p v-if="listTitle" class="ix-tokens-title">
      {{ listTitle }}
    </p>
    <div
      class="ix-tokens"
      :class="{ 'is-over': dnd.over.value === 'list' }"
      @dragover.prevent="dnd.over.value = 'list'"
      @dragleave="dnd.over.value = null"
      @drop.prevent="dnd.dropOnList($event)"
    >
      <button
        v-for="[key] in entries"
        :key="key"
        type="button"
        class="ix-token"
        :class="{ 'is-used': dnd.used(key), 'is-picked': dnd.picked.value === key }"
        :draggable="!disabled"
        :disabled="disabled"
        @click="dnd.clickToken(key)"
        @dragstart="dnd.dragToken(key, $event)"
      >
        {{ textFor(key) }}
      </button>
    </div>
    <div style="margin-top: 20px">
      <template v-for="sub in subs" :key="sub.questionNumber">
        <!-- A heading gap that has its place in the passage goes there, above its paragraph. -->
        <Teleport v-if="slotted.has(sub.questionNumber ?? 0)" :to="`#heading-slot-${sub.questionNumber}`">
          <IxQuestionsDropGap
            :n="sub.questionNumber ?? 0"
            :text="answers[sub.questionNumber ?? 0] ? textFor(answers[sub.questionNumber ?? 0]) : ''"
            :state="state(sub.questionNumber ?? 0, sub.correctAnswer)"
            :over="dnd.over.value === sub.questionNumber"
            :disabled="disabled"
            block
            @focus="focus(sub.questionNumber ?? 0)"
            @pick="dnd.clickGap(sub.questionNumber ?? 0)"
            @take="dnd.dragToken(answers[sub.questionNumber ?? 0]!, $event, sub.questionNumber ?? 0)"
            @enter="dnd.over.value = sub.questionNumber ?? 0"
            @leave="dnd.over.value = null"
            @drop="dnd.dropOnGap(sub.questionNumber ?? 0, $event)"
          />
          <span v-if="keyText(sub.questionNumber ?? 0, sub.correctAnswer)" class="ix-key is-block">{{ keyText(sub.questionNumber ?? 0, sub.correctAnswer) }}</span>
        </Teleport>
        <div v-else class="ix-item">
          <div class="ix-prompt" style="margin-bottom: 6px">
            <IxQuestionsNum :n="sub.questionNumber ?? 0" />
            <span>{{ sub.questionText }}</span>
          </div>
          <IxQuestionsDropGap
            :n="sub.questionNumber ?? 0"
            :text="answers[sub.questionNumber ?? 0] ? textFor(answers[sub.questionNumber ?? 0]) : ''"
            :state="state(sub.questionNumber ?? 0, sub.correctAnswer)"
            :over="dnd.over.value === sub.questionNumber"
            :disabled="disabled"
            block
            @focus="focus(sub.questionNumber ?? 0)"
            @pick="dnd.clickGap(sub.questionNumber ?? 0)"
            @take="dnd.dragToken(answers[sub.questionNumber ?? 0]!, $event, sub.questionNumber ?? 0)"
            @enter="dnd.over.value = sub.questionNumber ?? 0"
            @leave="dnd.over.value = null"
            @drop="dnd.dropOnGap(sub.questionNumber ?? 0, $event)"
          />
          <span v-if="keyText(sub.questionNumber ?? 0, sub.correctAnswer)" class="ix-key">{{ keyText(sub.questionNumber ?? 0, sub.correctAnswer) }}</span>
        </div>
      </template>
    </div>
  </div>
</template>
