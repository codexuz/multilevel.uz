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

const imgWidth = ref<number | null>(null)
const imgPanel = ref<HTMLElement>()
let drag: { startX: number, startWidth: number } | null = null

function onPointerDown(e: PointerEvent) {
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  drag = { startX: e.clientX, startWidth: imgWidth.value ?? imgPanel.value?.offsetWidth ?? 300 }
}
function onPointerMove(e: PointerEvent) {
  if (!drag) return
  const maxW = imgPanel.value?.parentElement?.parentElement?.offsetWidth ?? 900
  imgWidth.value = Math.min(Math.max(drag.startWidth + e.clientX - drag.startX, 200), maxW)
}
function onPointerUp() {
  drag = null
}
</script>

<template>
  <div>
    <ExamQuestionsHeading :question="question" />

    <div class="flex flex-wrap md:flex-nowrap items-start gap-4">
      <div
        v-if="imageSrc"
        ref="imgPanel"
        class="relative shrink-0 min-w-52 max-w-full"
        :style="{ width: imgWidth ? `${imgWidth}px` : '45%' }"
      >
        <UCard
          :ui="{ body: 'p-0 sm:p-0' }"
          class="overflow-hidden"
        >
          <img
            :src="imageSrc"
            :alt="mode === 'map' ? 'Plan / map' : 'Diagram'"
            class="w-full object-contain select-none"
            draggable="false"
          >
        </UCard>
        <UButton
          icon="i-lucide-grip-vertical"
          color="neutral"
          variant="ghost"
          size="xs"
          class="absolute top-1/2 -right-3 -translate-y-1/2 cursor-ew-resize touch-none"
          aria-label="Resize image"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        />
      </div>

      <div class="flex-1 min-w-0 space-y-3">
        <template v-if="mode === 'map'">
          <div
            v-if="remainingText"
            class="rich-content mb-4"
            v-html="remainingText"
          />
          <UCard
            v-if="options.some(o => o.optionText?.trim())"
            variant="soft"
            :ui="{ body: 'p-3 sm:p-3 space-y-1' }"
          >
            <p
              v-for="o in options"
              :key="o.optionKey"
            >
              <strong>{{ o.optionKey }}</strong>{{ o.optionText ? ` — ${o.optionText}` : '' }}
            </p>
          </UCard>
          <div
            v-for="sub in question.questions ?? []"
            :key="sub.questionNumber"
            class="flex items-center gap-3 p-2 rounded-md"
            :class="showResults && answers[sub.questionNumber ?? 0] ? (answers[sub.questionNumber ?? 0]!.toUpperCase() === (sub.correctAnswer ?? '').toUpperCase() ? 'bg-success/10' : 'bg-error/10') : ''"
          >
            <ExamQuestionsNum :n="sub.questionNumber ?? 0" />
            <span class="font-medium flex-1">{{ sub.questionText }}</span>
            <ExamQuestionsKeySelect
              :n="sub.questionNumber ?? 0"
              :keys="options.map(o => o.optionKey)"
              :model-value="answers[sub.questionNumber ?? 0]"
              :correct="sub.correctAnswer"
              :disabled="disabled"
              :show-results="showResults"
              case-insensitive
              @answer="(n, v) => emit('answer', n, v)"
            />
            <UBadge
              v-if="showResults && answers[sub.questionNumber ?? 0]"
              :label="answers[sub.questionNumber ?? 0]!.toUpperCase() === (sub.correctAnswer ?? '').toUpperCase() ? '✓' : `✗ ${sub.correctAnswer}`"
              :color="answers[sub.questionNumber ?? 0]!.toUpperCase() === (sub.correctAnswer ?? '').toUpperCase() ? 'success' : 'error'"
              variant="soft"
            />
          </div>
        </template>

        <template v-else>
          <div
            v-for="(sub, idx) in question.questions ?? []"
            :key="sub.questionNumber"
            class="flex items-start gap-3"
          >
            <ExamQuestionsNum :n="sub.questionNumber ?? 0" />
            <div class="flex-1 leading-loose">
              <template v-if="(gapSentences[idx] ?? sub.questionText ?? '').split(/_{2,}/).length > 1">
                <template
                  v-for="(part, i) in (gapSentences[idx] ?? sub.questionText ?? '').split(/_{2,}/)"
                  :key="i"
                >
                  {{ part }}
                  <ExamQuestionsBlank
                    v-if="i < (gapSentences[idx] ?? sub.questionText ?? '').split(/_{2,}/).length - 1"
                    :n="sub.questionNumber ?? 0"
                    :model-value="answers[sub.questionNumber ?? 0]"
                    :correct="sub.correctAnswer"
                    :disabled="disabled"
                    :show-results="showResults"
                    placeholder="Your answer"
                    width="w-40"
                    @answer="(n, v) => emit('answer', n, v)"
                  />
                </template>
              </template>
              <template v-else>
                <div
                  v-if="gapSentences[idx] ?? sub.questionText"
                  class="rich-content mb-2"
                  v-html="gapSentences[idx] ?? sub.questionText"
                />
                <ExamQuestionsBlank
                  :n="sub.questionNumber ?? 0"
                  :model-value="answers[sub.questionNumber ?? 0]"
                  :correct="sub.correctAnswer"
                  :disabled="disabled"
                  :show-results="showResults"
                  placeholder="Type your answer"
                  width="w-full max-w-xs !mx-0"
                  @answer="(n, v) => emit('answer', n, v)"
                />
              </template>
              <p
                v-if="showResults && answers[sub.questionNumber ?? 0] && answers[sub.questionNumber ?? 0]!.toLowerCase().trim() !== (sub.correctAnswer ?? '').toLowerCase().trim()"
                class="text-xs text-success mt-1"
              >
                Correct: {{ sub.correctAnswer }}
              </p>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
