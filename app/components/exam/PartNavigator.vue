<script setup lang="ts">
import type { AnswerMap, PartData } from '~/types/exam'

const { t } = useI18n()

type NavPart = { id: string, partLabel: string, questions?: PartData['questions'], totalQuestions?: number }

const props = defineProps<{
  parts: NavPart[]
  currentPart: number
  currentQuestion?: number | null
  answers?: AnswerMap
  canPrev?: boolean
  canNext?: boolean
}>()

const emit = defineEmits<{
  'update:currentPart': [index: number]
  'question': [num: number]
  'prev': []
  'next': []
}>()

function nums(part: NavPart) {
  return part.questions ? getAllQuestionNumbers(part.questions) : []
}
function answeredCount(part: NavPart) {
  return nums(part).filter(n => !!props.answers?.[n]).length
}
</script>

<template>
  <nav class="shrink-0 flex items-stretch min-h-12 border-t border-default bg-default overflow-x-auto sticky bottom-0 z-20">
    <div
      v-for="(part, idx) in parts"
      :key="part.id"
      :class="[
        'flex items-center gap-2 px-3 py-1.5 border-t-3 border-e border-e-default cursor-pointer md:flex-1 shrink-0 hover:bg-elevated/50 transition-colors',
        idx === currentPart ? 'border-t-primary min-w-[min(78vw,320px)] md:min-w-0' : 'border-t-transparent min-w-28 md:min-w-0'
      ]"
      @click="emit('update:currentPart', idx)"
    >
      <UButton
        :label="part.partLabel"
        color="neutral"
        variant="link"
        :class="['px-0 whitespace-nowrap', idx === currentPart ? 'font-bold text-highlighted' : 'text-muted']"
        @click.stop="emit('update:currentPart', idx)"
      />

      <div
        v-if="idx === currentPart && part.questions"
        class="flex flex-wrap gap-0.5 min-w-0"
      >
        <UButton
          v-for="n in nums(part)"
          :key="n"
          :label="String(n)"
          size="xs"
          square
          class="size-6 justify-center text-[10px] font-semibold"
          :color="answers?.[n] ? 'success' : n === currentQuestion ? 'primary' : 'neutral'"
          :variant="answers?.[n] || n === currentQuestion ? 'solid' : 'outline'"
          @click.stop="emit('question', n)"
        />
      </div>
      <UBadge
        v-else-if="part.questions"
        :label="`${answeredCount(part)} of ${part.totalQuestions}`"
        color="neutral"
        variant="soft"
        size="sm"
      />
    </div>

    <div class="flex items-center gap-1 px-2 border-s border-default shrink-0 ms-auto">
      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="ghost"
        class="rounded-full"
        :disabled="canPrev === false"
        :aria-label="t('exam.previous')"
        @click="emit('prev')"
      />
      <UButton
        icon="i-lucide-chevron-right"
        color="neutral"
        variant="ghost"
        class="rounded-full"
        :disabled="canNext === false"
        :aria-label="t('exam.next')"
        @click="emit('next')"
      />
    </div>
  </nav>
</template>
