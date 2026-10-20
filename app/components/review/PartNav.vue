<script setup lang="ts">
import type { Part } from '~/types/ielts'

/** The parts along the bottom, as in the exam: the open one lists its questions, coloured by mark. */
defineProps<{ parts: Part[] }>()
const current = defineModel<number>({ default: 0 })
const emit = defineEmits<{ jump: [number: number] }>()

const itemsOf = (p: Part) => partItems(p)
const correctOf = (p: Part) => itemsOf(p).filter(i => i.isCorrect).length

const tone = {
  success: 'border-success bg-success/10 text-success',
  error: 'border-error bg-error/10 text-error',
  neutral: 'border-default text-muted'
}

function go(idx: number, n?: number) {
  current.value = idx
  if (n != null) emit('jump', n)
}
</script>

<template>
  <nav
    v-if="parts.length"
    class="shrink-0 flex items-stretch min-h-12 border-t border-default bg-default overflow-x-auto z-20"
  >
    <div
      v-for="(part, idx) in parts"
      :key="part.id"
      :class="[
        'flex items-center gap-2 px-3 py-1.5 border-t-3 border-e border-e-default cursor-pointer md:flex-1 shrink-0 hover:bg-elevated/50 transition-colors',
        idx === current ? 'border-t-primary min-w-[min(78vw,340px)] md:min-w-0' : 'border-t-transparent min-w-28 md:min-w-0'
      ]"
      @click="go(idx)"
    >
      <span :class="['text-sm whitespace-nowrap', idx === current ? 'font-bold text-highlighted' : 'text-muted']">Part {{ part.partNumber }}</span>

      <div
        v-if="idx === current"
        class="flex flex-wrap gap-0.5 min-w-0"
      >
        <button
          v-for="item in itemsOf(part)"
          :key="item.id"
          type="button"
          :aria-label="`Question ${item.number}`"
          :class="['size-6 rounded border text-[10px] font-semibold tabular-nums', tone[itemColor(item)]]"
          @click.stop="go(idx, item.number)"
        >
          {{ item.number }}
        </button>
      </div>
      <UBadge
        v-else-if="itemsOf(part).length"
        :label="`${correctOf(part)} of ${itemsOf(part).length}`"
        color="neutral"
        variant="soft"
        size="sm"
        class="shrink-0 tabular-nums"
      />
    </div>
  </nav>
</template>
