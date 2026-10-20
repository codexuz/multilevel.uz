<script setup lang="ts">
import type { IELTSQuestionOption, IELTSQuestionType } from '~/types/ielts'

const props = defineProps<{ type: IELTSQuestionType }>()
const options = defineModel<IELTSQuestionOption[]>({ required: true })

const single = computed(() => props.type === 'MULTIPLE_CHOICE')
const markable = computed(() => props.type === 'MULTIPLE_CHOICE' || props.type === 'MULTIPLE_ANSWER')

function rekey(list: IELTSQuestionOption[]) {
  return list.map((o, i) => ({ ...o, optionKey: String.fromCharCode(65 + i), orderIndex: i }))
}

function add() {
  options.value = rekey([...options.value, { optionKey: '', optionText: '', isCorrect: false, orderIndex: options.value.length }])
}

function remove(i: number) {
  options.value = rekey(options.value.filter((_, idx) => idx !== i))
}

function toggleCorrect(i: number, value: boolean) {
  options.value = options.value.map((o, idx) => single.value
    ? { ...o, isCorrect: idx === i ? value : false }
    : idx === i ? { ...o, isCorrect: value } : o)
}
</script>

<template>
  <UCard
    variant="subtle"
    :ui="{ header: 'py-2.5 sm:px-4', body: 'sm:p-4 space-y-2' }"
  >
    <template #header>
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium">{{ optionsLabel(type) }}</span>
        <UButton
          icon="i-lucide-plus"
          label="Add option"
          size="xs"
          variant="soft"
          @click="add"
        />
      </div>
    </template>

    <div
      v-for="(opt, i) in options"
      :key="i"
      class="flex items-center gap-2"
    >
      <UBadge
        :label="opt.optionKey"
        color="neutral"
        variant="outline"
        class="rounded-full min-w-7 h-7 justify-center shrink-0"
      />
      <UInput
        v-model="opt.optionText"
        placeholder="Option text"
        class="flex-1"
      />
      <UCheckbox
        v-if="markable"
        :model-value="opt.isCorrect"
        label="Correct"
        @update:model-value="v => toggleCorrect(i, v === true)"
      />
      <UButton
        icon="i-lucide-x"
        color="error"
        variant="ghost"
        size="sm"
        aria-label="Remove option"
        @click="remove(i)"
      />
    </div>
    <p
      v-if="!options.length"
      class="text-xs text-muted text-center py-2"
    >
      No options yet.
    </p>
  </UCard>
</template>
