<script setup lang="ts">
import type { ExerciseType, LmsExerciseDto, LmsQuestionDto, LmsQuestionType } from '#shared/utils/lms'

interface ExerciseFull extends LmsExerciseDto {
  questions: LmsQuestionDto[]
  course?: { id: string, slug: string, title: string }
}

const props = defineProps<{
  exerciseId: string
}>()

const emit = defineEmits<{ updated: [], close: [] }>()
const { t } = useI18n()
const { confirm } = useDialogs()
const toast = useToast()

const { data: ex, refresh } = await useFetch<ExerciseFull>(() => `/api/course-exercises/${props.exerciseId}`)
const isSpeaking = computed(() => ex.value?.exerciseType === 'SPEAKING')

const tab = ref<'questions' | 'settings' | 'preview'>('questions')
const tabs = computed(() => [
  { label: isSpeaking.value ? t('speakingStudio.promptsTab') : t('xe.questionsTab', { n: ex.value?.questions?.length ?? 0 }), value: 'questions', icon: isSpeaking.value ? 'i-lucide-mic' : 'i-lucide-list-checks' },
  { label: t('xe.settingsTab'), value: 'settings', icon: 'i-lucide-sliders-horizontal' },
  ...(!isSpeaking.value ? [{ label: t('builder.preview'), value: 'preview', icon: 'i-lucide-eye' }] : [])
])

const settings = reactive({
  title: '',
  instructions: '',
  exerciseType: 'PRACTICE' as ExerciseType,
  passingScore: 70,
  timeLimitMinutes: undefined as number | undefined,
  maxAttempts: undefined as number | undefined,
  shuffleQuestions: false,
  requiredForCompletion: false
})

watch(ex, (v) => {
  if (!v) return
  settings.title = v.title
  settings.instructions = v.instructions ?? ''
  settings.exerciseType = v.exerciseType
  settings.passingScore = v.passingScore
  settings.timeLimitMinutes = v.timeLimitSeconds ? Math.round(v.timeLimitSeconds / 60) : undefined
  settings.maxAttempts = v.maxAttempts ?? undefined
  settings.shuffleQuestions = v.shuffleQuestions
  settings.requiredForCompletion = v.requiredForCompletion
  if (v.exerciseType === 'SPEAKING' && tab.value === 'preview') tab.value = 'questions'
}, { immediate: true })

const savingSettings = ref(false)
async function saveSettings() {
  if (!settings.title.trim()) return
  savingSettings.value = true
  try {
    await $fetch(`/api/course-exercises/${props.exerciseId}`, {
      method: 'PATCH',
      body: {
        title: settings.title,
        instructions: settings.instructions || null,
        exerciseType: settings.exerciseType,
        passingScore: settings.passingScore,
        timeLimitSeconds: settings.timeLimitMinutes ? settings.timeLimitMinutes * 60 : null,
        maxAttempts: settings.maxAttempts || null,
        shuffleQuestions: settings.shuffleQuestions,
        requiredForCompletion: settings.requiredForCompletion
      }
    })
    await refresh()
    emit('updated')
    toast.add({ title: t('courses.saved'), color: 'success' })
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    savingSettings.value = false
  }
}

// Question authoring state
const pickingType = ref(false)
const editingQuestion = ref<LmsQuestionDto | null>(null)
const newQuestionType = ref<LmsQuestionType>('SINGLE_CHOICE')
const questionModalOpen = ref(false)

function openNewQuestion(t: LmsQuestionType) {
  pickingType.value = false
  editingQuestion.value = null
  newQuestionType.value = t
  questionModalOpen.value = true
}

function openEditQuestion(q: LmsQuestionDto) {
  editingQuestion.value = q
  newQuestionType.value = q.type
  questionModalOpen.value = true
}

async function onQuestionSaved() {
  questionModalOpen.value = false
  await refresh()
  emit('updated')
}

async function moveQuestion(idx: number, delta: -1 | 1) {
  const list = [...(ex.value?.questions ?? [])]
  const j = idx + delta
  if (j < 0 || j >= list.length) return
  ;[list[idx], list[j]] = [list[j]!, list[idx]!]
  await $fetch(`/api/course-exercises/${props.exerciseId}/questions/order`, {
    method: 'POST',
    body: { ids: list.map(q => q.id) }
  })
  await refresh()
}

async function deleteQuestion(q: LmsQuestionDto) {
  if (!await confirm({ title: t('xe.deleteQuestion'), confirmLabel: t('builder.delete'), color: 'error' })) return
  await $fetch(`/api/course-questions/${q.id}`, { method: 'DELETE' })
  await refresh()
  emit('updated')
}
</script>

<template>
  <div
    v-if="ex"
    class="flex flex-col gap-4"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <UTabs
        v-model="tab"
        :items="tabs"
        :content="false"
      />
      <UButton
        v-if="tab === 'questions' && !isSpeaking"
        :label="t('xe.addQuestion')"
        icon="i-lucide-plus"
        size="sm"
        @click="pickingType = !pickingType"
      />
    </div>

    <!-- Speaking Studio Exercise Prompts (appended as a widget to the lesson) -->
    <CourseBuilderSpeaking
      v-if="tab === 'questions' && isSpeaking && ex.course"
      :course-id="ex.course.id"
      :course-slug="ex.course.slug"
      :exercise-id="ex.id"
      :lesson-id="ex.lessonId"
      @changed="emit('updated')"
    />

    <!-- 12-Type Visual Question Picker -->
    <UCard
      v-if="tab === 'questions' && !isSpeaking && pickingType"
      :ui="{ body: 'p-4 flex flex-col gap-3' }"
    >
      <div class="flex items-center justify-between">
        <p class="text-sm font-semibold text-highlighted">
          {{ t('xe.chooseType') }}
        </p>
        <UButton
          icon="i-lucide-x"
          size="xs"
          color="neutral"
          variant="ghost"
          @click="pickingType = false"
        />
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <button
          v-for="opt in LMS_QUESTION_OPTIONS"
          :key="opt.type"
          type="button"
          class="flex items-start gap-2.5 p-3 rounded-xl ring ring-default bg-default hover:bg-primary/5 hover:ring-primary/50 text-start transition-all cursor-pointer"
          @click="openNewQuestion(opt.type)"
        >
          <div class="size-8 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
            <UIcon
              :name="opt.icon"
              class="size-4"
            />
          </div>
          <div class="min-w-0">
            <p class="text-xs font-semibold text-highlighted">
              {{ t(`lmsq.${opt.type}.label`) }}
            </p>
            <p class="text-[11px] text-muted line-clamp-2 mt-0.5">
              {{ t(`lmsq.${opt.type}.text`) }}
            </p>
          </div>
        </button>
      </div>
    </UCard>

    <!-- Questions List -->
    <template v-if="tab === 'questions' && !isSpeaking">
      <ol
        v-if="ex.questions.length"
        class="rounded-xl ring ring-default divide-y divide-default overflow-hidden"
      >
        <li
          v-for="(q, idx) in ex.questions"
          :key="q.id"
          class="flex items-center gap-3 px-4 py-3 hover:bg-elevated/40"
        >
          <span class="size-7 rounded-full bg-elevated text-xs font-bold grid place-items-center shrink-0">{{ idx + 1 }}</span>
          <button
            type="button"
            class="flex-1 min-w-0 text-start cursor-pointer"
            @click="openEditQuestion(q)"
          >
            <div class="flex items-center gap-2">
              <UBadge
                :label="t(`lmsq.${q.type}.short`)"
                :icon="LMS_QUESTION_META[q.type]?.icon"
                color="primary"
                variant="subtle"
                size="xs"
              />
              <span class="text-xs text-muted">{{ q.points }} pt{{ q.points === 1 ? '' : 's' }}</span>
            </div>
            <p class="text-sm font-medium text-highlighted truncate mt-1">
              {{ q.prompt || q.context || '(No prompt)' }}
            </p>
          </button>
          <UButton
            icon="i-lucide-arrow-up"
            size="xs"
            color="neutral"
            variant="ghost"
            :disabled="idx === 0"
            @click="moveQuestion(idx, -1)"
          />
          <UButton
            icon="i-lucide-arrow-down"
            size="xs"
            color="neutral"
            variant="ghost"
            :disabled="idx === ex.questions.length - 1"
            @click="moveQuestion(idx, 1)"
          />
          <UButton
            icon="i-lucide-pencil"
            size="xs"
            color="neutral"
            variant="ghost"
            @click="openEditQuestion(q)"
          />
          <UButton
            icon="i-lucide-trash-2"
            size="xs"
            color="error"
            variant="ghost"
            @click="deleteQuestion(q)"
          />
        </li>
      </ol>
      <UEmpty
        v-else
        icon="i-lucide-blocks"
        :title="t('xe.noQuestions')"
        :description="t('xe.noQuestionsText')"
        :actions="[{ label: t('xe.addQuestion'), icon: 'i-lucide-plus', onClick: () => { pickingType = true } }]"
        variant="naked"
      />
    </template>

    <!-- Exercise Settings -->
    <form
      v-else-if="tab === 'settings'"
      class="grid gap-4"
      @submit.prevent="saveSettings"
    >
      <div class="grid sm:grid-cols-3 gap-3">
        <UFormField
          :label="t('builder.quizTitle')"
          class="sm:col-span-2"
        >
          <UInput
            v-model="settings.title"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('builder.quizKind')">
          <USelect
            v-model="settings.exerciseType"
            :items="EXERCISE_TYPES.map(x => ({ label: t(`builder.exType.${x}`), value: x }))"
            class="w-full"
          />
        </UFormField>
      </div>
      <UFormField :label="t('xe.instructions')">
        <UTextarea
          v-model="settings.instructions"
          :rows="2"
          class="w-full"
        />
      </UFormField>
      <div
        v-if="settings.exerciseType !== 'SPEAKING'"
        class="grid sm:grid-cols-3 gap-3"
      >
        <UFormField :label="t('xe.passScore')">
          <UInputNumber
            v-model="settings.passingScore"
            :min="0"
            :max="100"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('xe.timeLimit')">
          <UInputNumber
            v-model="settings.timeLimitMinutes"
            :min="1"
            :max="240"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('xe.maxAttempts')">
          <UInputNumber
            v-model="settings.maxAttempts"
            :min="1"
            :max="50"
            class="w-full"
          />
        </UFormField>
      </div>
      <div class="flex flex-col gap-2">
        <USwitch
          v-model="settings.requiredForCompletion"
          :label="t('xe.required')"
          :description="t('xe.requiredText')"
        />
        <USwitch
          v-if="settings.exerciseType !== 'SPEAKING'"
          v-model="settings.shuffleQuestions"
          :label="t('xe.shuffle')"
        />
      </div>
      <div class="flex justify-end">
        <UButton
          type="submit"
          :label="t('common.save')"
          :loading="savingSettings"
        />
      </div>
    </form>

    <!-- Live Interactive Student Preview -->
    <LmsExercisePlayer
      v-else-if="tab === 'preview' && !isSpeaking"
      :exercise-id="exerciseId"
    />

    <!-- Question Create/Edit Modal -->
    <UModal
      v-model:open="questionModalOpen"
      :title="editingQuestion ? t('xe.editQuestion') : t('xe.newQuestion', { type: t(`lmsq.${newQuestionType}.label`) })"
      :ui="{ content: 'sm:max-w-3xl' }"
    >
      <template #body>
        <LmsQuestionEditor
          v-if="questionModalOpen"
          :key="editingQuestion?.id ?? newQuestionType"
          :exercise-id="exerciseId"
          :question="editingQuestion"
          :initial-type="newQuestionType"
          @saved="onQuestionSaved"
          @close="questionModalOpen = false"
        />
      </template>
    </UModal>
  </div>
</template>
