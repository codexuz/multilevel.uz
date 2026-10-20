<script setup lang="ts">
import { libraryAPI } from '~/services/ielts'
import type { IELTSQuestion, IELTSQuestionOption, IELTSQuestionType, IELTSSubQuestion, Part, QuestionGroup } from '~/types/ielts'
import OptionsEditor from './question-editors/OptionsEditor.vue'
import HeadingOptionsEditor from './question-editors/HeadingOptionsEditor.vue'
import TableDataEditor from './question-editors/TableDataEditor.vue'
import SubQuestionsEditor from './question-editors/SubQuestionsEditor.vue'

const props = defineProps<{
  partId: string
  /** The group being edited; empty for a new one. */
  group?: QuestionGroup | null
  /** Suggested question number for new groups. */
  nextNumber?: number
}>()
const emit = defineEmits<{ saved: [part: Part] }>()
const question = computed<IELTSQuestion | null>(() => (props.group ? toEditorQuestion(props.group) : null))
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const saving = ref(false)

interface EditorState {
  type: IELTSQuestionType
  instruction: string
  questionText: string
  questionNumber?: number
  points?: number
  headings: { key: string, text: string }[]
  tableHeaders: string[]
  tableRows: string[][]
  subs: IELTSSubQuestion[]
  options: IELTSQuestionOption[]
}

const state = reactive<EditorState>(blank())
// Bumped on every reset so the rich editors remount with the new content.
const editorKey = ref(0)

function blank(): EditorState {
  return {
    type: 'TRUE_FALSE_NOT_GIVEN',
    instruction: DEFAULT_INSTRUCTIONS.TRUE_FALSE_NOT_GIVEN,
    questionText: '',
    questionNumber: undefined,
    points: 1,
    headings: [],
    tableHeaders: [''],
    tableRows: [['']],
    subs: [],
    options: []
  }
}

function reset() {
  const q = question.value
  const next = blank()
  if (q) {
    next.type = q.type ?? next.type
    next.instruction = q.instruction ?? DEFAULT_INSTRUCTIONS[next.type]
    next.questionText = q.questionText ?? ''
    next.questionNumber = q.questionNumber
    next.points = Number(q.points ?? 1)
    next.headings = Object.entries(q.headingOptions ?? {}).map(([key, text]) => ({ key, text: String(text) }))
    next.tableHeaders = q.tableData?.headers?.length ? [...q.tableData.headers] : ['']
    next.tableRows = q.tableData?.rows?.length ? q.tableData.rows.map(r => [...r]) : [['']]
    next.subs = (q.questions ?? []).map(sq => ({
      id: sq.id,
      questionNumber: sq.questionNumber,
      questionText: sq.questionText ?? '',
      correctAnswer: sq.correctAnswer ?? '',
      explanation: sq.explanation ?? '',
      fromPassage: sq.fromPassage ?? '',
      points: sq.points ? Number(sq.points) : 1,
      order: sq.order ?? 1
    }))
    next.options = (q.options ?? []).map(o => ({
      id: o.id,
      optionKey: o.optionKey,
      optionText: o.optionText,
      isCorrect: !!o.isCorrect,
      orderIndex: o.orderIndex ?? 0
    }))
  } else {
    next.questionNumber = props.nextNumber
  }
  Object.assign(state, next)
  editorKey.value++
}

watch([open, () => props.group], ([v]) => {
  if (v) reset()
}, { immediate: true })

function changeType(t: IELTSQuestionType) {
  state.type = t
  state.instruction = DEFAULT_INSTRUCTIONS[t]
  if (!usesHeadingOptions(t)) state.headings = []
  if (t !== 'TABLE_COMPLETION') {
    state.tableHeaders = ['']
    state.tableRows = [['']]
  }
  editorKey.value++
}

const typeItems = QUESTION_TYPES.map(t => ({ label: t.label, value: t.value, icon: t.icon }))

const isEmptyHtml = (html: string) => !html || html === '<p></p>'

async function save() {
  const t = state.type
  const edited: IELTSQuestion = {
    type: t,
    questionText: isEmptyHtml(state.questionText) ? undefined : state.questionText,
    instruction: isEmptyHtml(state.instruction) ? undefined : state.instruction,
    context: question.value?.context,
    questionNumber: state.questionNumber,
    points: state.points || 1,
    explanation: question.value?.explanation,
    fromPassage: question.value?.fromPassage,
    headingOptions: usesHeadingOptions(t) && state.headings.length ? Object.fromEntries(state.headings.filter(h => h.key).map(h => [h.key, h.text])) : undefined,
    tableData: t === 'TABLE_COMPLETION' ? { headers: state.tableHeaders, rows: state.tableRows } : undefined,
    // A multiple-choice group keeps its one item's id on questions[0].
    questions: usesSubQuestions(t) ? state.subs.map(sub => ({ ...sub, points: sub.points ?? state.points ?? 1 })) : (question.value?.questions?.slice(0, 1) ?? []),
    options: usesOptions(t) ? state.options : []
  }
  saving.value = true
  try {
    const body = fromEditorQuestion(edited)
    const part = props.group?.id ? await libraryAPI.updateGroup(props.group.id, body) : await libraryAPI.createGroup(props.partId, body)
    toast.add({ title: props.group?.id ? 'Question group updated' : 'Question group added', color: 'success' })
    open.value = false
    emit('saved', part)
  } catch (e) {
    toast.add({ title: 'Could not save the questions', description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="group?.id ? 'Edit question group' : 'Add question group'"
    :description="TYPE_HINTS[state.type]"
    :ui="{ content: 'sm:max-w-3xl', body: 'space-y-5' }"
  >
    <template #body>
      <div class="grid sm:grid-cols-[1fr_8rem_6rem] gap-3">
        <UFormField label="Question type">
          <USelectMenu
            :model-value="state.type"
            :items="typeItems"
            value-key="value"
            :icon="questionTypeIcon(state.type)"
            class="w-full"
            @update:model-value="v => changeType(v as IELTSQuestionType)"
          />
        </UFormField>
        <UFormField label="Start number">
          <UInputNumber
            v-model="state.questionNumber"
            :min="1"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Points">
          <UInputNumber
            v-model="state.points"
            :min="0"
            class="w-full"
          />
        </UFormField>
      </div>

      <div class="flex flex-wrap gap-1.5">
        <UBadge
          v-if="usesSubQuestions(state.type)"
          label="Sub-questions"
          color="success"
          variant="subtle"
        />
        <UBadge
          v-if="usesOptions(state.type)"
          label="Options"
          color="secondary"
          variant="subtle"
        />
        <UBadge
          v-if="state.type === 'MATCHING_HEADINGS'"
          label="Heading options"
          color="warning"
          variant="subtle"
        />
        <UBadge
          v-if="state.type === 'MATCHING_INFORMATION'"
          label="Paragraph options"
          color="warning"
          variant="subtle"
        />
        <UBadge
          v-if="state.type === 'TABLE_COMPLETION'"
          label="Table data"
          color="warning"
          variant="subtle"
        />
        <UBadge
          v-if="state.type === 'MULTIPLE_CHOICE'"
          label="Single correct"
          color="info"
          variant="subtle"
        />
        <UBadge
          v-if="state.type === 'MULTIPLE_ANSWER'"
          label="Multiple correct"
          color="info"
          variant="subtle"
        />
      </div>

      <UFormField label="Instruction">
        <BuilderRichEditor
          :key="`i${editorKey}`"
          v-model="state.instruction"
          toolbar="basic"
          min-height="min-h-16"
        />
      </UFormField>

      <UFormField :label="questionTextLabel(state.type)">
        <BuilderRichEditor
          :key="`q${editorKey}`"
          v-model="state.questionText"
          min-height="min-h-24"
        />
      </UFormField>

      <HeadingOptionsEditor
        v-if="usesHeadingOptions(state.type)"
        v-model="state.headings"
        :type="state.type"
      />
      <TableDataEditor
        v-if="state.type === 'TABLE_COMPLETION'"
        v-model:headers="state.tableHeaders"
        v-model:rows="state.tableRows"
      />
      <OptionsEditor
        v-if="usesOptions(state.type)"
        v-model="state.options"
        :type="state.type"
      />
      <SubQuestionsEditor
        v-if="usesSubQuestions(state.type)"
        v-model="state.subs"
        :type="state.type"
        :start-number="state.questionNumber"
        :options="state.options"
        :headings="state.headings"
      />
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          label="Cancel"
          color="neutral"
          variant="outline"
          @click="() => { open = false }"
        />
        <UButton
          :label="group?.id ? 'Update questions' : 'Add questions'"
          icon="i-lucide-save"
          :loading="saving"
          @click="save"
        />
      </div>
    </template>
  </USlideover>
</template>
