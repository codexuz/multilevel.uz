<script setup lang="ts">
import type { ReviewNavPart } from '~/composables/useReviewMarks'

/**
 * The bar at the bottom, as in the test: each part with how many of its questions earned a mark;
 * the part on screen opens into its numbers, the strip over each green for a mark and red for none.
 * The ← → buttons over it move between parts. A writing task is one part with one strip.
 */
const props = defineProps<{ parts: ReviewNavPart[] }>()
const current = defineModel<number>({ default: 0 })
const emit = defineEmits<{ jump: [n: number] }>()

const right = (p: ReviewNavPart) => (p.questions ?? []).filter(q => q.correct).length
</script>

<template>
  <div v-if="parts.length > 1" class="ix-arrows">
    <button type="button" class="ix-arrow is-prev" :disabled="current <= 0" aria-label="Previous part" data-testid="nav-prev" @click="current--">
      <svg viewBox="0 0 448 512" aria-hidden="true"><path d="M9.4 233.4a32 32 0 0 0 0 45.3l160 160a32 32 0 0 0 45.3-45.3L109.3 288H416a32 32 0 1 0 0-64H109.3l105.3-105.4a32 32 0 0 0-45.3-45.3l-160 160z" /></svg>
    </button>
    <button type="button" class="ix-arrow is-next" :disabled="current >= props.parts.length - 1" aria-label="Next part" data-testid="nav-next" @click="current++">
      <svg viewBox="0 0 448 512" aria-hidden="true"><path d="M438.6 278.6a32 32 0 0 0 0-45.3l-160-160a32 32 0 0 0-45.3 45.3L338.8 224H32a32 32 0 1 0 0 64h306.7L233.4 393.4a32 32 0 0 0 45.3 45.3l160-160z" /></svg>
    </button>
  </div>

  <nav class="ix-footer is-review" aria-label="Questions" data-testid="part-nav">
    <template v-for="(part, idx) in parts" :key="part.id">
      <div
        v-if="idx === current"
        class="ix-fpart is-current"
        :class="{ 'is-single': !part.questions, 'is-answered': !part.questions && part.done }"
        :data-testid="`nav-part-${idx + 1}`"
      >
        <span class="ix-flabel">{{ part.label }}</span>
        <span v-if="!part.questions && part.count" class="ix-fcount">{{ part.count }}</span>
        <div v-if="part.questions" class="ix-qnums">
          <button
            v-for="q in part.questions"
            :key="q.n"
            type="button"
            class="ix-qnum"
            :class="q.correct ? 'is-right' : 'is-wrong'"
            :aria-label="`Question ${q.n}, ${q.correct ? 'correct' : q.answered ? 'incorrect' : 'not answered'}`"
            :data-testid="`nav-q-${q.n}`"
            @click="emit('jump', q.n)"
          >
            {{ q.n }}
          </button>
        </div>
      </div>
      <button
        v-else
        type="button"
        class="ix-fpart"
        :aria-label="`${part.label}. ${part.questions ? `${right(part)} of ${part.questions.length} correct` : part.count ?? ''}`"
        :data-testid="`nav-part-${idx + 1}`"
        @click="current = idx"
      >
        <span class="ix-flabel">{{ part.label }}</span>
        <span class="ix-fcount">{{ part.questions ? `${right(part)} of ${part.questions.length}` : part.count }}</span>
      </button>
    </template>
  </nav>
</template>
