<script setup lang="ts">
import type { PartNode } from '~/composables/useTestBuilder'
import type { EditableQuestion } from './QuestionEditor.vue'
import type { QuestionType, Choice, QuestionMeta, CompletionGroup } from '~/types/exam'

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

// Completion groups (summary/note/table etc.) stored in content.groups.
const groups = computed<CompletionGroup[]>({
  get: () => ((props.part.content as { groups?: CompletionGroup[] }).groups ?? []),
  set: (v) => { props.part.content = { ...(props.part.content as object), groups: v } }
})
function addGroup() {
  const g: CompletionGroup = { kind: 'summary_completion', heading: '', template: '' }
  groups.value = [...groups.value, g]
}
function updateGroup(i: number, g: CompletionGroup) {
  const arr = [...groups.value]
  arr[i] = g
  groups.value = arr
}
function removeGroup(i: number) {
  groups.value = groups.value.filter((_, idx) => idx !== i)
}

// Numbers consumed by a group's {{n}} tokens — these text_input drafts are edited
// inside the group, so they're hidden from the standalone question list.
const groupedNumbers = computed(() => {
  const set = new Set<number>()
  for (const g of groups.value) {
    const text = g.template ?? (g.rows?.flat().join(' ') ?? '')
    for (const m of text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) set.add(Number(m[1]))
  }
  return set
})
function isGrouped(q: EditableQuestion) {
  return q.type === 'text_input' && q.question_number != null && groupedNumbers.value.has(q.question_number)
}

// Completions only apply to reading/listening parts.
const supportsGroups = computed(() => isReading.value || isListening.value)

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

// --- Autosave -------------------------------------------------------------
// Part fields (title/instructions/passage/groups/audio/image).
const partSig = computed(() => JSON.stringify({
  title: props.part.title,
  instructions: props.part.instructions,
  content: props.part.content,
  audio_url: props.part.audio_url,
  image_url: props.part.image_url
}))
const savePart = useDebouncedCallback(() => emit('savePart', props.part))
watch(partSig, savePart.trigger)

// Questions. Signature excludes ids so the id-backfill after saving doesn't
// retrigger a save. Removed-question ids are read at flush time.
const draftsSig = computed(() => JSON.stringify(
  drafts.value.map(({ id: _id, ...rest }) => rest)
))
function flushQuestions() {
  emit('saveQuestions', drafts.value, removedIds.value)
  removedIds.value = []
}
// draftsSig changes on any edit, add, or removal (fewer items); removedIds is
// read at flush time, so it doesn't need its own trigger.
const saveQuestions = useDebouncedCallback(flushQuestions, 800)
watch(draftsSig, saveQuestions.trigger)
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
          label="Listening text (optional — shown alongside the questions)"
        >
          <AdminRichEditor
            v-model="passage"
            placeholder="Notes, transcript or context text…"
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
            allow-url
            url-placeholder="Or paste an audio URL…"
          />
        </UFormField>
        <UFormField label="Part image (optional — e.g. a map, plan or diagram)">
          <FileUpload
            v-model="part.image_url"
            purpose="test-asset"
            accept="image/*"
            preview="image"
            label="Upload part image"
            allow-url
            url-placeholder="Or paste an image URL…"
          />
        </UFormField>
      </div>
      <div class="flex flex-col gap-1">
        <UButton
          icon="i-lucide-trash-2"
          size="sm"
          variant="ghost"
          color="error"
          @click="emit('deletePart', part.id)"
        />
      </div>
    </div>

    <!-- Completion groups (summary/note/table with inline blanks) -->
    <template v-if="supportsGroups">
      <USeparator label="Completion groups" />
      <div class="space-y-4">
        <AdminCompletionGroupEditor
          v-for="(g, gi) in groups"
          :key="`group-${gi}`"
          :model-value="g"
          :drafts="drafts"
          @update:model-value="updateGroup(gi, $event)"
          @remove="removeGroup(gi)"
        />
        <UButton
          icon="i-lucide-plus"
          variant="soft"
          color="primary"
          label="Add completion group"
          @click="addGroup"
        />
        <p class="text-xs text-muted">
          Blanks defined here create their own gap-fill questions — they won't appear in the list below.
        </p>
      </div>
    </template>

    <USeparator label="Questions" />

    <div class="space-y-4">
      <template
        v-for="(q, i) in drafts"
        :key="q.id || i"
      >
        <AdminQuestionEditor
          v-if="!isGrouped(q)"
          :model-value="q"
          :section-type="sectionType"
          @update:model-value="drafts[i] = $event"
          @remove="removeQuestion(i)"
        />
      </template>
    </div>

    <div class="flex items-center justify-between">
      <UButton
        icon="i-lucide-plus"
        variant="soft"
        label="Add question"
        @click="addQuestion"
      />
    </div>
  </div>
</template>
