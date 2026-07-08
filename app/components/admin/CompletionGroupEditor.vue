<script setup lang="ts">
import type { CompletionGroup, CompletionKind } from '~/types/exam'
import type { EditableQuestion } from './QuestionEditor.vue'

const model = defineModel<CompletionGroup>({ required: true })
// The part's question drafts. Each {{n}} blank is backed by a text_input draft
// (matched by question_number); we create/read them here so the admin edits the
// shared shell and the per-blank accepted answers in one place.
const props = defineProps<{ drafts: EditableQuestion[] }>()
const emit = defineEmits<{ remove: [] }>()

const KIND_ITEMS: { label: string, value: CompletionKind }[] = [
  { label: 'Summary completion', value: 'summary_completion' },
  { label: 'Note completion', value: 'note_completion' },
  { label: 'Sentence completion', value: 'sentence_completion' },
  { label: 'Flow-chart completion', value: 'flow_chart_completion' },
  { label: 'Table completion', value: 'table_completion' }
]

const isTable = computed(() => model.value.kind === 'table_completion')

// --- blank detection -------------------------------------------------------
function numbersIn(text: string): number[] {
  return [...text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map(m => Number(m[1]))
}
const blankNumbers = computed(() => {
  const text = model.value.template ?? (model.value.rows?.flat().join(' ') ?? '')
  return [...new Set(numbersIn(text))].sort((a, b) => a - b)
})

// Next free question number across all drafts + existing blanks.
function nextNumber(): number {
  const used = [
    ...props.drafts.map(d => d.question_number ?? 0),
    ...blankNumbers.value
  ]
  return Math.max(0, ...used) + 1
}

function ensureDraft(n: number) {
  if (props.drafts.some(d => d.question_number === n && d.type === 'text_input')) return
  props.drafts.push({
    type: 'text_input',
    question_number: n,
    prompt: '',
    options: [],
    correct_answer: [],
    points: 1,
    meta: {}
  })
}

function draftFor(n: number) {
  return props.drafts.find(d => d.question_number === n && d.type === 'text_input')
}

// --- editing actions -------------------------------------------------------
function insertBlank() {
  const n = nextNumber()
  const token = `{{${n}}}`
  if (isTable.value) {
    // Drop the token into the last cell of the last row.
    const rows = model.value.rows ?? [['']]
    const lastRow = rows[rows.length - 1]!
    lastRow[lastRow.length - 1] = `${lastRow[lastRow.length - 1] ?? ''} ${token}`.trim()
    model.value.rows = [...rows]
  } else {
    model.value.template = `${model.value.template ?? ''} ${token}`.trim()
  }
  ensureDraft(n)
}

// Reconcile: make sure every {{n}} in the shell has a backing draft.
function syncBlanks() {
  for (const n of blankNumbers.value) ensureDraft(n)
}

function acceptedFor(n: number): string {
  const d = draftFor(n)
  const a = d?.correct_answer
  return Array.isArray(a) ? a.join(', ') : (a ?? '')
}
function setAccepted(n: number, v: string) {
  ensureDraft(n)
  const d = draftFor(n)!
  d.correct_answer = v.split(',').map(s => s.trim()).filter(Boolean)
}

// --- table text helpers (columns comma-separated, rows one line, cells " | ") --
const columnsText = computed({
  get: () => (model.value.columns ?? []).join(', '),
  set: (v: string) => { model.value.columns = v.split(',').map(s => s.trim()).filter(Boolean) }
})
const rowsText = computed({
  get: () => (model.value.rows ?? []).map(r => r.join(' | ')).join('\n'),
  set: (v: string) => {
    model.value.rows = v.split('\n').map(line => line.split('|').map(c => c.trim()))
  }
})
</script>

<template>
  <div class="space-y-3 rounded-lg border border-dashed border-primary/40 p-4 bg-primary/5">
    <div class="flex items-center gap-2">
      <UIcon
        name="i-lucide-list-tree"
        class="text-primary"
      />
      <USelect
        v-model="model.kind"
        :items="KIND_ITEMS"
        value-key="value"
        class="w-56"
      />
      <div class="flex-1" />
      <UButton
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        size="sm"
        @click="emit('remove')"
      />
    </div>

    <UFormField label="Instruction / heading">
      <UInput
        v-model="model.heading"
        class="w-full"
        placeholder="e.g. Complete the summary. Write ONE WORD ONLY."
      />
    </UFormField>

    <!-- Paragraph-style template -->
    <UFormField
      v-if="!isTable"
      label="Text (use the button to add a numbered blank, then move the {{n}} token where the gap belongs)"
    >
      <UTextarea
        v-model="model.template"
        :rows="4"
        class="w-full font-mono text-sm"
        placeholder="The village was damaged by heavy {{10}}, made worse after offshore {{11}} was removed…"
        autoresize
      />
    </UFormField>

    <!-- Table editor -->
    <div
      v-else
      class="space-y-2"
    >
      <UFormField label="Columns (comma-separated)">
        <UInput
          v-model="columnsText"
          class="w-full"
          placeholder="Year, Event"
        />
      </UFormField>
      <UFormField label="Rows (one per line, cells separated by | — put {{n}} where a blank goes)">
        <UTextarea
          v-model="rowsText"
          :rows="4"
          class="w-full font-mono text-sm"
          placeholder="1917 | A severe {{15}} destroyed the houses."
          autoresize
        />
      </UFormField>
    </div>

    <div class="flex items-center gap-2">
      <UButton
        icon="i-lucide-plus"
        size="xs"
        variant="soft"
        label="Insert blank"
        @click="insertBlank"
      />
      <UButton
        icon="i-lucide-refresh-cw"
        size="xs"
        variant="ghost"
        label="Sync blanks"
        @click="syncBlanks"
      />
      <span class="text-xs text-muted">{{ blankNumbers.length }} blank(s): {{ blankNumbers.join(', ') || '—' }}</span>
    </div>

    <!-- Per-blank accepted answers (backed by text_input questions) -->
    <div
      v-if="blankNumbers.length"
      class="space-y-2 rounded-md border border-default p-3 bg-default"
    >
      <p class="text-xs font-medium text-muted">
        Accepted answers per blank
      </p>
      <div
        v-for="n in blankNumbers"
        :key="n"
        class="flex items-center gap-2"
      >
        <UBadge
          :label="String(n)"
          color="neutral"
          variant="subtle"
          class="shrink-0"
        />
        <UInput
          :model-value="acceptedFor(n)"
          class="flex-1"
          size="sm"
          placeholder="Accepted answers (comma-separated), e.g. storms, storm"
          @update:model-value="setAccepted(n, String($event))"
        />
      </div>
    </div>
  </div>
</template>
