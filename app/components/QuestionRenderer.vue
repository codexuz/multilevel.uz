<script setup lang="ts">
import type { StudentQuestionDto } from '~/types/models'

const props = defineProps<{
  question: StudentQuestionDto
  response?: string | string[] | null
  audioUrl?: string | null
}>()
const emit = defineEmits<{
  'update:response': [string | string[] | null]
  'update:audioUrl': [string | null]
}>()

const q = computed(() => props.question)

// text/essay/single/dropdown response as string
const textValue = computed({
  get: () => (typeof props.response === 'string' ? props.response : ''),
  set: v => emit('update:response', v)
})

// multiple choice as string[]
const multiValue = computed<string[]>({
  get: () => (Array.isArray(props.response) ? props.response : []),
  set: v => emit('update:response', v)
})

const wordCount = computed(() => (textValue.value.trim() ? textValue.value.trim().split(/\s+/).length : 0))
const selectItems = computed(() => q.value.options.map(o => ({ label: o.label, value: o.value })))
</script>

<template>
  <div class="space-y-3">
    <div class="flex gap-2">
      <UBadge
        v-if="q.questionNumber != null"
        :label="String(q.questionNumber)"
        color="neutral"
        variant="subtle"
        class="shrink-0 mt-0.5"
      />
      <p
        v-if="q.prompt"
        class="font-medium"
        v-html="q.prompt"
      />
    </div>

    <!-- Single choice -->
    <URadioGroup
      v-if="q.type === 'single_choice'"
      :model-value="textValue"
      :items="selectItems"
      @update:model-value="emit('update:response', String($event))"
    />

    <!-- Multiple choice -->
    <UCheckboxGroup
      v-else-if="q.type === 'multiple_choice'"
      v-model="multiValue"
      :items="selectItems"
    />

    <!-- Gap fill -->
    <UInput
      v-else-if="q.type === 'text_input'"
      v-model="textValue"
      class="max-w-sm"
      placeholder="Type your answer"
    />

    <!-- Dropdown match -->
    <USelect
      v-else-if="q.type === 'dropdown_match'"
      :model-value="textValue"
      :items="selectItems"
      value-key="value"
      class="w-40"
      placeholder="Select"
      @update:model-value="emit('update:response', String($event))"
    />

    <!-- Essay -->
    <div
      v-else-if="q.type === 'essay'"
      class="space-y-1"
    >
      <UTextarea
        v-model="textValue"
        :rows="8"
        class="w-full"
        placeholder="Write your answer here…"
        autoresize
      />
      <div class="flex justify-between text-xs text-muted">
        <span>Words: {{ wordCount }}</span>
        <span v-if="q.meta?.wordLimit">Suggested limit: {{ q.meta.wordLimit }}</span>
      </div>
    </div>

    <!-- Speaking prompt -->
    <div
      v-else-if="q.type === 'speaking_prompt'"
      class="space-y-2"
    >
      <img
        v-if="q.meta?.imageUrl"
        :src="q.meta.imageUrl"
        alt="prompt"
        class="max-h-56 rounded-lg border border-default"
      >
      <SpeakingRecorder
        :model-value="audioUrl"
        :prep-time="q.meta?.prepTime"
        :speak-time="q.meta?.speakTime"
        @update:model-value="emit('update:audioUrl', $event)"
      />
    </div>
  </div>
</template>
