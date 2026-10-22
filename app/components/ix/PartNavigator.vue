<script setup lang="ts">
import type { AnswerMap, PartData } from '~/types/exam'

/**
 * The bar at the bottom of the test, as the computer-delivered IELTS has it: each part with how many
 * of its questions are answered; the part on screen opens into its question numbers, a strip over
 * each turning green once answered and a box round the one in hand. Over it, the ← → buttons, and
 * at its end the ✓ that opens the submission page.
 */
type NavPart = { id: string, partLabel: string, questions?: PartData['questions'], totalQuestions?: number, answered?: boolean }

const props = defineProps<{
  parts: NavPart[]
  currentPart: number
  currentQuestion?: number | null
  answers?: AnswerMap
  canPrev?: boolean
  canNext?: boolean
  /** The submission page is open: no part is current and the ✓ is lit. */
  submitting?: boolean
}>()

const emit = defineEmits<{
  'update:currentPart': [index: number]
  'question': [num: number]
  'prev': []
  'next': []
  'deliver': []
}>()

function nums(part: NavPart) {
  return part.questions ? getAllQuestionNumbers(part.questions) : []
}
function total(part: NavPart) {
  return part.questions ? nums(part).length : (part.totalQuestions ?? 1)
}
function answeredCount(part: NavPart) {
  if (!part.questions) return part.answered ? 1 : 0
  return nums(part).filter(n => !!props.answers?.[n]).length
}
</script>

<template>
  <div class="ix-arrows">
    <button type="button" class="ix-arrow is-prev" :disabled="canPrev === false" aria-label="Previous" data-testid="nav-prev" @click="emit('prev')">
      <svg viewBox="0 0 448 512" aria-hidden="true"><path d="M9.4 233.4a32 32 0 0 0 0 45.3l160 160a32 32 0 0 0 45.3-45.3L109.3 288H416a32 32 0 1 0 0-64H109.3l105.3-105.4a32 32 0 0 0-45.3-45.3l-160 160z" /></svg>
    </button>
    <button type="button" class="ix-arrow is-next" :disabled="canNext === false" aria-label="Next" data-testid="nav-next" @click="emit('next')">
      <svg viewBox="0 0 448 512" aria-hidden="true"><path d="M438.6 278.6a32 32 0 0 0 0-45.3l-160-160a32 32 0 0 0-45.3 45.3L338.8 224H32a32 32 0 1 0 0 64h306.7L233.4 393.4a32 32 0 0 0 45.3 45.3l160-160z" /></svg>
    </button>
  </div>

  <nav class="ix-footer" aria-label="Questions" data-testid="part-nav">
    <template v-for="(part, idx) in parts" :key="part.id">
      <div
        v-if="idx === currentPart && !submitting"
        class="ix-fpart is-current"
        :class="{ 'is-single': !part.questions, 'is-answered': !part.questions && part.answered }"
        :data-testid="`nav-part-${idx + 1}`"
      >
        <span class="ix-flabel">{{ part.partLabel }}</span>
        <div v-if="part.questions" class="ix-qnums">
          <button
            v-for="n in nums(part)"
            :key="n"
            type="button"
            class="ix-qnum"
            :class="{ 'is-answered': !!answers?.[n], 'is-current': n === currentQuestion }"
            :aria-label="`Question ${n}${answers?.[n] ? ', attempted' : ', not attempted'}`"
            :aria-current="n === currentQuestion ? 'step' : undefined"
            :data-testid="`nav-q-${n}`"
            @click="emit('question', n)"
          >
            {{ n }}
          </button>
        </div>
      </div>
      <button
        v-else
        type="button"
        class="ix-fpart"
        :aria-label="`${part.partLabel}. ${answeredCount(part)} of ${total(part)} questions attempted.`"
        :data-testid="`nav-part-${idx + 1}`"
        @click="emit('update:currentPart', idx)"
      >
        <span class="ix-flabel">{{ part.partLabel }}</span>
        <span class="ix-fcount">{{ answeredCount(part) }} of {{ total(part) }}</span>
      </button>
    </template>
    <button
      type="button"
      class="ix-deliver"
      :class="{ 'is-active': submitting }"
      aria-label="Review your answers and submit"
      title="Review and submit"
      data-testid="deliver"
      @click="emit('deliver')"
    >
      <UIcon name="i-lucide-check" />
    </button>
  </nav>
</template>
