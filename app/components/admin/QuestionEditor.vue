<script setup lang="ts">
import type { QuestionType, Choice, QuestionMeta } from '~/types/exam'
import { QUESTION_TYPE_META, WRITING_TASKS, SPEAKING_PARTS } from '~/types/exam'

export interface EditableQuestion {
  id?: string
  type: QuestionType
  question_number: number | null
  prompt: string
  options: Choice[]
  correct_answer: string | string[] | null
  points: number
  meta: QuestionMeta
}

const model = defineModel<EditableQuestion>({ required: true })
defineProps<{ sectionType?: string }>()
const emit = defineEmits<{ remove: [] }>()

const typeItems = (Object.keys(QUESTION_TYPE_META) as QuestionType[]).map(t => ({
  label: QUESTION_TYPE_META[t].label,
  value: t
}))

function addOption() {
  const next = String.fromCharCode(65 + model.value.options.length) // A, B, C...
  model.value.options.push({ value: next, label: '' })
}
function removeOption(i: number) {
  model.value.options.splice(i, 1)
}

// multiple choice correct answer as array toggle
function toggleMulti(val: string) {
  const arr = Array.isArray(model.value.correct_answer) ? [...model.value.correct_answer] : []
  const idx = arr.indexOf(val)
  if (idx === -1) arr.push(val)
  else arr.splice(idx, 1)
  model.value.correct_answer = arr
}
function isMultiChecked(val: string) {
  return Array.isArray(model.value.correct_answer) && model.value.correct_answer.includes(val)
}
function setCorrectAnswer(val: string) {
  model.value.correct_answer = val
}

const showChoices = computed(() => ['single_choice', 'multiple_choice', 'dropdown_match'].includes(model.value.type))
const meta = computed(() => model.value.meta)
</script>

<template>
  <UCard :ui="{ body: 'space-y-4' }">
    <template #header>
      <div class="flex items-center gap-3">
        <UInput
          v-model.number="model.question_number"
          type="number"
          class="w-20"
          placeholder="#"
          :ui="{ base: 'text-center' }"
        />
        <USelect
          v-model="model.type"
          :items="typeItems"
          value-key="value"
          class="flex-1"
        />
        <UInput
          v-model.number="model.points"
          type="number"
          step="0.5"
          class="w-24"
          icon="i-lucide-star"
        />
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          @click="emit('remove')"
        />
      </div>
    </template>

    <UFormField label="Question / prompt">
      <UTextarea
        v-model="model.prompt"
        :rows="2"
        class="w-full"
        placeholder="Enter the question text…"
        autoresize
      />
    </UFormField>

    <!-- Choice-based options -->
    <div
      v-if="showChoices"
      class="space-y-2"
    >
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium">Options</span>
        <UButton
          size="xs"
          variant="soft"
          icon="i-lucide-plus"
          label="Add option"
          @click="addOption"
        />
      </div>
      <div
        v-for="(opt, i) in model.options"
        :key="i"
        class="flex items-center gap-2"
      >
        <!-- correct answer selector -->
        <UButton
          v-if="model.type === 'multiple_choice'"
          :icon="isMultiChecked(opt.value) ? 'i-lucide-check-square' : 'i-lucide-square'"
          :color="isMultiChecked(opt.value) ? 'primary' : 'neutral'"
          variant="ghost"
          @click="toggleMulti(opt.value)"
        />
        <UButton
          v-else
          :icon="model.correct_answer === opt.value ? 'i-lucide-circle-check' : 'i-lucide-circle'"
          :color="model.correct_answer === opt.value ? 'primary' : 'neutral'"
          variant="ghost"
          @click="setCorrectAnswer(opt.value)"
        />
        <UInput
          v-model="opt.value"
          class="w-16"
          placeholder="A"
        />
        <UInput
          v-model="opt.label"
          class="flex-1"
          placeholder="Option text"
        />
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="xs"
          @click="removeOption(i)"
        />
      </div>
      <p class="text-xs text-muted">
        Click the circle/box to mark the correct answer{{ model.type === 'multiple_choice' ? '(s)' : '' }}.
      </p>
    </div>

    <!-- Text gap fill -->
    <UFormField
      v-if="model.type === 'text_input'"
      label="Accepted answers (comma-separated)"
    >
      <UInput
        :model-value="Array.isArray(model.correct_answer) ? model.correct_answer.join(', ') : (model.correct_answer || '')"
        class="w-full"
        placeholder="e.g. library, the library"
        @update:model-value="model.correct_answer = String($event).split(',').map(s => s.trim()).filter(Boolean)"
      />
    </UFormField>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField label="Explanation">
        <UTextarea
          v-model="meta.explanation"
          :rows="3"
          class="w-full"
          placeholder="Explain why this answer is correct…"
          autoresize
        />
      </UFormField>
      <UFormField label="From text">
        <UTextarea
          v-model="meta.fromText"
          :rows="3"
          class="w-full"
          placeholder="Paste the passage line or phrase used for this question…"
          autoresize
        />
      </UFormField>
    </div>

    <!-- Essay (writing) -->
    <div
      v-if="model.type === 'essay'"
      class="grid sm:grid-cols-2 gap-4"
    >
      <UFormField label="Task label">
        <USelect
          v-model="meta.taskLabel"
          :items="([...WRITING_TASKS] as string[])"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Word limit">
        <UInput
          v-model.number="meta.wordLimit"
          type="number"
          class="w-full"
          placeholder="e.g. 250"
        />
      </UFormField>
    </div>

    <!-- Speaking prompt -->
    <div
      v-if="model.type === 'speaking_prompt'"
      class="space-y-4"
    >
      <div class="grid sm:grid-cols-3 gap-4">
        <UFormField label="Part">
          <USelect
            v-model="meta.taskLabel"
            :items="([...SPEAKING_PARTS] as string[])"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Prep time (s)">
          <UInput
            v-model.number="meta.prepTime"
            type="number"
            class="w-full"
            placeholder="60"
          />
        </UFormField>
        <UFormField label="Speak time (s)">
          <UInput
            v-model.number="meta.speakTime"
            type="number"
            class="w-full"
            placeholder="120"
          />
        </UFormField>
      </div>
      <UFormField label="Prompt image (optional)">
        <FileUpload
          :model-value="(meta.imageUrl as string) || null"
          purpose="test-asset"
          accept="image/*"
          preview="image"
          label="Upload image"
          @update:model-value="meta.imageUrl = $event || undefined"
        />
      </UFormField>
    </div>
  </UCard>
</template>
