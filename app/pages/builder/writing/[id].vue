<script setup lang="ts">
import type { WritingTask } from '~/types/ielts'
import { libraryAPI } from '~/services/ielts'

/** A Writing task: Task 1.1 (an informal letter), Task 1.2 (a formal letter) or Task 2 (an essay), with its word minimum. */
definePageMeta({ middleware: 'admin' })

const route = useRoute()
const toast = useToast()
const { confirm } = useDialogs()
const id = computed(() => String(route.params.id))
const back = computed(() => (route.query.test ? `/builder/tests/${route.query.test}` : '/builder?tab=writing'))

const { data: task, status, error } = useAsyncData<WritingTask>(() => `writing:${id.value}`, () => libraryAPI.writingTask(id.value), { watch: [id] })
useSeoMeta({ title: () => `${task.value?.title || `Writing ${writingTaskLabel(task.value?.taskNumber)}`} — Builder`, robots: 'noindex' })

const form = reactive({ taskNumber: 3 as 1 | 2 | 3, title: '', prompt: '', imageRef: null as string | null, minWords: null as number | null, suggestedMinutes: null as number | null })
const editorKey = ref(0)

const payload = () => ({
  taskNumber: form.taskNumber, title: form.title.trim() || null, prompt: form.prompt || '<p></p>',
  imageRef: form.imageRef, minWords: form.minWords, suggestedMinutes: form.suggestedMinutes
})
const autosave = useAutosave(payload, async () => {
  const saved = await libraryAPI.updateWritingTask(id.value, payload())
  if (task.value) task.value.imageUrl = saved.imageUrl
})
watch(task, (t, old) => {
  if (!t || t.id === old?.id) return
  Object.assign(form, { taskNumber: t.taskNumber as 1 | 2 | 3, title: t.title ?? '', prompt: t.prompt ?? '', imageRef: t.imageRef ?? null, minWords: t.minWords ?? null, suggestedMinutes: t.suggestedMinutes ?? null })
  editorKey.value++
  nextTick(() => autosave.markClean())
}, { immediate: true })
watch(autosave.state, (s) => { if (s === 'error') toast.add({ title: 'Changes not saved', color: 'error' }) })

async function remove() {
  if (!await confirm({ title: 'Delete this task?', description: 'A task in a test or with essays cannot be deleted.', confirmLabel: 'Delete' })) return
  try {
    await libraryAPI.deleteWritingTask(id.value)
    await navigateTo(back.value)
  } catch (e) {
    toast.add({ title: 'Not deleted', description: errorMessage(e), color: 'error' })
  }
}
const saveLabel = computed(() => ({ idle: '', dirty: 'Unsaved changes', saving: 'Saving…', saved: 'Saved', error: 'Not saved' })[autosave.state.value])
</script>

<template>
  <AppPage
    :title="task ? (task.title || `Writing ${writingTaskLabel(task.taskNumber)}`) : 'Writing task'"
    :back="back"
    wide
  >
    <template #actions>
      <span class="text-xs text-muted max-sm:hidden">{{ saveLabel }}</span>
      <UButton
        icon="i-lucide-trash"
        color="neutral"
        variant="ghost"
        square
        @click="remove"
      />
    </template>

    <div
      v-if="status === 'pending' && !task"
      class="grid gap-4"
    >
      <USkeleton class="h-80" />
    </div>
    <UEmpty
      v-else-if="error"
      icon="i-lucide-circle-alert"
      title="This task could not be opened"
      :description="errorMessage(error)"
    />
    <div
      v-else-if="task"
      class="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start"
    >
      <div class="grid gap-4 min-w-0">
        <UCard>
          <template #header>
            <p class="font-semibold text-highlighted">
              Question
            </p>
          </template>
          <BuilderRichEditor
            :key="editorKey"
            v-model="form.prompt"
            toolbar="basic"
            placeholder="The task as candidates read it."
            min-height="min-h-48"
          />
        </UCard>
        <UCard>
          <template #header>
            <p class="font-semibold text-highlighted">
              Picture (optional)
            </p>
          </template>
          <BuilderFileField
            v-model="form.imageRef"
            kind="image"
            :url="task.imageUrl"
          />
        </UCard>
      </div>
      <UCard class="lg:sticky lg:top-4">
        <template #header>
          <p class="font-semibold text-highlighted">
            Details
          </p>
        </template>
        <div class="grid gap-3">
          <UFormField
            label="Title"
            help="For the library only."
          >
            <UInput
              v-model="form.title"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Task"
            help="Task 1.1 and 1.2 share one situation; put it in both questions."
          >
            <USelect
              v-model="form.taskNumber"
              :items="[1, 2, 3].map(n => ({ label: writingTaskLabel(n), value: n }))"
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField
              label="Minimum words"
              :help="`Default ${writingDefaults(form.taskNumber).minWords}`"
            >
              <UInputNumber
                v-model="form.minWords"
                :min="20"
                :max="1000"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Minutes"
              :help="`Default ${writingDefaults(form.taskNumber).minutes}`"
            >
              <UInputNumber
                v-model="form.suggestedMinutes"
                :min="1"
                :max="120"
                class="w-full"
              />
            </UFormField>
          </div>
          <p
            v-if="task.essays"
            class="text-xs text-muted"
          >
            {{ task.essays }} essays written for this task.
          </p>
        </div>
      </UCard>
    </div>
  </AppPage>
</template>
