<script setup lang="ts">
import type { PartNode } from '~/composables/useTestBuilder'
import type { EditableQuestion } from './QuestionEditor.vue'
import type { QuestionType, Choice, QuestionMeta } from '~/types/exam'

const props = defineProps<{ part: PartNode, sectionType: string }>()
const emit = defineEmits<{
  savePart: [PartNode]
  saveQuestions: [drafts: EditableQuestion[], removedIds: string[]]
  deletePart: [string]
}>()

const isReading = computed(() => props.sectionType === 'reading')
const isListening = computed(() => props.sectionType === 'listening')

// Reading passage stored in content.passage
const passage = computed({
  get: () => (props.part.content as Record<string, string>)?.passage ?? '',
  set: (v: string) => {
    props.part.content = { ...(props.part.content as object), passage: v }
  }
})

// Question drafts
function toDraft(q: PartNode['questions'][number]): EditableQuestion {
  return {
    id: q.id,
    type: q.type,
    question_number: q.question_number,
    prompt: q.prompt ?? '',
    options: (q.options as unknown as Choice[]) ?? [],
    correct_answer: q.correct_answer as string | string[] | null,
    points: q.points,
    meta: (q.meta as unknown as QuestionMeta) ?? {}
  }
}

const drafts = ref<EditableQuestion[]>(props.part.questions.map(toDraft))
const removedIds = ref<string[]>([])

const defaultType = computed<QuestionType>(() => (props.sectionType === 'writing' ? 'essay' : props.sectionType === 'speaking' ? 'speaking_prompt' : 'single_choice'))

function addQuestion() {
  drafts.value.push({
    type: defaultType.value,
    question_number: (drafts.value.at(-1)?.question_number ?? 0) + 1,
    prompt: '',
    options: defaultType.value === 'single_choice' ? [{ value: 'A', label: '' }, { value: 'B', label: '' }, { value: 'C', label: '' }] : [],
    correct_answer: null,
    points: 1,
    meta: defaultType.value === 'speaking_prompt' ? { prepTime: 30, speakTime: 60 } : {}
  })
}
function removeQuestion(i: number) {
  const q = drafts.value[i]
  if (q?.id) removedIds.value.push(q.id)
  drafts.value.splice(i, 1)
}
</script>

<template>
  <div class="space-y-4 rounded-lg border border-default p-4 bg-elevated/20">
    <div class="flex items-start gap-3">
      <div class="flex-1 space-y-3">
        <UInput
          v-model="part.title"
          class="w-full font-medium"
          placeholder="Part title (e.g. Part 1: Questions 1–8)"
        />
        <UTextarea
          :model-value="part.instructions ?? ''"
          class="w-full"
          :rows="2"
          placeholder="Instructions for this part…"
          autoresize
          @update:model-value="part.instructions = $event"
        />
        <UFormField
          v-if="isReading"
          label="Reading passage"
        >
          <AdminRichEditor
            v-model="passage"
            placeholder="Passage text…"
          />
        </UFormField>
        <UFormField
          v-if="isListening"
          label="Part audio (optional — overrides section audio)"
        >
          <FileUpload
            v-model="part.audio_url"
            purpose="test-audio"
            accept="audio/*"
            preview="audio"
            label="Upload part audio"
          />
        </UFormField>
      </div>
      <div class="flex flex-col gap-1">
        <UButton
          icon="i-lucide-save"
          size="sm"
          variant="soft"
          label="Save part"
          @click="emit('savePart', part)"
        />
        <UButton
          icon="i-lucide-trash-2"
          size="sm"
          variant="ghost"
          color="error"
          @click="emit('deletePart', part.id)"
        />
      </div>
    </div>

    <USeparator label="Questions" />

    <div class="space-y-4">
      <AdminQuestionEditor
        v-for="(q, i) in drafts"
        :key="q.id || i"
        :model-value="q"
        :section-type="sectionType"
        @update:model-value="drafts[i] = $event"
        @remove="removeQuestion(i)"
      />
    </div>

    <div class="flex items-center justify-between">
      <UButton
        icon="i-lucide-plus"
        variant="soft"
        label="Add question"
        @click="addQuestion"
      />
      <UButton
        icon="i-lucide-save"
        color="primary"
        label="Save questions"
        @click="emit('saveQuestions', drafts, removedIds); removedIds = []"
      />
    </div>
  </div>
</template>
