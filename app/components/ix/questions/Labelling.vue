<script setup lang="ts">
import type { QuestionEmits, QuestionProps } from '~/types/question-props'

const props = defineProps<QuestionProps & { mode: 'diagram' | 'map' }>()
const emit = defineEmits<QuestionEmits>()

const html = computed(() => props.question.questionText ?? '')
const imageSrc = computed(() => html.value.match(/<img[^>]+src="([^"]+)"/)?.[1] ?? null)

const gapSentences = computed(() => {
  const out: string[] = []
  const re = /<li[^>]*>([\s\S]*?)<\/li>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html.value)) !== null) {
    const t = m[1]!.replace(/<[^>]*>/g, '').trim()
    if (t) out.push(t)
  }
  return out
})

const remainingText = computed(() => html.value.replace(/<img[^>]*>/gi, '').replace(/<p>\s*<\/p>/gi, '').trim())
const options = computed(() => [...(props.question.options ?? [])].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)))

const rows = computed(() => (props.question.questions ?? []).map(s => ({ n: s.questionNumber ?? 0, text: s.questionText ?? '', correct: s.correctAnswer ?? '' })))
// Each label's sentence split at its gap ("___" or "{n}"); one without a gap has its box after it.
const labels = computed(() => (props.question.questions ?? []).map((sub, idx) => ({ sub, text: gapSentences.value[idx] ?? sub.questionText ?? '', gaps: promptGaps(gapSentences.value[idx] ?? sub.questionText ?? '', sub.questionNumber ?? 0) })))

// Side-by-side split resize (desktop flex-row, matching Multilevel Labelling + IELTS SplitPane)
const splitEl = ref<HTMLElement>()
const imgPanel = ref<HTMLElement>()
const imgShare = ref(45)
let dragging = false

function clampShare(pct: number) {
  return Math.min(75, Math.max(22, pct))
}
function onPointerDown(e: PointerEvent) {
  dragging = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onPointerMove(e: PointerEvent) {
  if (!dragging || !splitEl.value) return
  const box = splitEl.value.getBoundingClientRect()
  if (box.width <= 0) return
  imgShare.value = clampShare(((e.clientX - box.left) / box.width) * 100)
}
function onPointerUp() {
  dragging = false
}
function nudge(delta: number) {
  imgShare.value = clampShare(imgShare.value + delta)
}
</script>

<template>
  <div>
    <IxQuestionsHeading :question="question" />

    <div
      ref="splitEl"
      class="flex flex-col md:flex-row items-start gap-4 md:gap-0"
      data-testid="ix-labelling-split"
    >
      <div
        v-if="imageSrc"
        ref="imgPanel"
        class="w-full md:shrink-0 md:pr-3"
        :style="{ flexBasis: `${imgShare}%` }"
        data-testid="ix-labelling-image-pane"
      >
        <img
          :src="imageSrc"
          :alt="mode === 'map' ? 'Plan / map' : 'Diagram'"
          class="ix-image w-full object-contain select-none"
          draggable="false"
        >
      </div>

      <div
        v-if="imageSrc"
        class="hidden md:flex self-stretch items-center justify-center w-4 shrink-0 cursor-col-resize touch-none select-none group"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize image panel"
        data-testid="ix-labelling-resizer"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <div class="relative h-full min-h-32 w-0.5 bg-current opacity-25 group-hover:opacity-60 transition-opacity flex items-center justify-center">
          <button
            type="button"
            class="flex items-center justify-center size-7 rounded border border-current bg-[var(--ix-bg,#fff)] text-current opacity-100 cursor-col-resize shadow-xs"
            aria-label="Resize map panel (arrow keys)"
            @keydown.left.prevent="nudge(-5)"
            @keydown.right.prevent="nudge(5)"
          >
            <UIcon
              name="i-lucide-grip-vertical"
              class="size-3.5"
            />
          </button>
        </div>
      </div>

      <div
        class="flex-1 min-w-0 w-full overflow-x-auto"
        :class="imageSrc ? 'md:pl-3' : ''"
        data-testid="ix-labelling-questions-pane"
      >
        <template v-if="mode === 'map'">
          <div
            v-if="remainingText"
            class="ix-instruction"
            v-html="remainingText"
          />
          <IxQuestionsRadioGrid
            :rows="rows"
            :keys="options.map(o => o.optionKey)"
            :answers="answers"
            :disabled="disabled"
            :show-results="showResults"
            case-insensitive
            @answer="(n, v) => emit('answer', n, v)"
          />
        </template>

        <div v-else>
          <div
            v-for="{ sub, text, gaps } in labels"
            :key="sub.questionNumber"
            class="ix-item ix-gapline"
          >
            <template v-if="gaps.nums.length">
              <template
                v-for="(part, i) in gaps.parts"
                :key="i"
              >
                <IxQuestionsBlank
                  v-if="i > 0"
                  :n="gaps.nums[i - 1]!"
                  :model-value="answers[gaps.nums[i - 1]!]"
                  :correct="sub.correctAnswer"
                  :disabled="disabled"
                  :show-results="showResults"
                  @answer="(n, v) => emit('answer', n, v)"
                /><span v-html="part" />
              </template>
            </template>
            <div
              v-else
              class="ix-prompt"
            >
              <IxQuestionsNum :n="sub.questionNumber ?? 0" />
              <span>
                <span
                  v-if="text"
                  v-html="text"
                />
                <IxQuestionsBlank
                  :n="sub.questionNumber ?? 0"
                  :model-value="answers[sub.questionNumber ?? 0]"
                  :correct="sub.correctAnswer"
                  :disabled="disabled"
                  :show-results="showResults"
                  @answer="(n, v) => emit('answer', n, v)"
                />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
