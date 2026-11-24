<script setup lang="ts">
import type { LiveLesson } from '~/components/online/Row.vue'
import { uploadFile } from '~/services/http'

/**
 * A course lesson as its teacher writes it: the title, a text, a video address, a test to do (a
 * section or one part), PDFs, and, once saved, an online class on Google Meet.
 */
export interface EditableLesson {
  id: string
  title: string
  body: string | null
  videoUrl: string | null
  files: { name: string, url: string, size: number | null }[]
  task: { testId: string, test: string | null, skill: string | null, partNumber: number | null } | null
  live: LiveLesson | null
}
const props = defineProps<{ courseId: string, lesson: EditableLesson | null }>()
const emit = defineEmits<{ saved: [id: string], close: [] }>()
const { t } = useI18n()
const toast = useToast()
const route = useRoute()

const SKILLS = ['LISTENING', 'READING', 'WRITING', 'SPEAKING']
const form = reactive({
  title: props.lesson?.title ?? '',
  body: props.lesson?.body ?? '',
  videoUrl: props.lesson?.videoUrl ?? '',
  testId: props.lesson?.task?.testId as string | undefined,
  skill: props.lesson?.task?.skill ?? 'READING',
  part: props.lesson?.task?.partNumber ?? 0,
  files: [...(props.lesson?.files ?? [])]
})
const withTask = ref(!!props.lesson?.task)

const { data: testList } = await useFetch<{ items: { id: string, title: string, sections: { skill: string, items: number }[] }[] }>('/api/tests', { query: { limit: 60 }, lazy: true })
const testItems = computed(() => (testList.value?.items ?? []).map(x => ({ label: x.title, value: x.id })))
const skillItems = computed(() => {
  const test = testList.value?.items.find(x => x.id === form.testId)
  return SKILLS.filter(s => !test || test.sections.some(x => x.skill === s && x.items)).map(s => ({ label: skillLabel(s), value: s }))
})
const partItems = computed(() => [{ label: t('centre.wholeSection'), value: 0 }, ...(PART_NUMBERS[form.skill] ?? []).map(n => ({ label: partName(form.skill, n), value: n }))])
watch(() => form.testId, () => {
  if (!skillItems.value.some(s => s.value === form.skill)) form.skill = skillItems.value[0]?.value ?? 'READING'
})

// ---- files (PDF) ----
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
async function addFiles(e: Event) {
  const list = [...((e.target as HTMLInputElement).files ?? [])]
  if (!list.length) return
  uploading.value = true
  try {
    for (const f of list) {
      if (f.type !== 'application/pdf') {
        toast.add({ title: t('courses.pdfOnly'), description: f.name, color: 'warning' })
        continue
      }
      const up = await uploadFile(f, { purpose: 'course-file' })
      form.files.push({ name: f.name.replace(/\.pdf$/i, ''), url: up.url, size: f.size })
    }
  } catch (err) {
    toast.add({ title: t('courses.notUploaded'), description: errorMessage(err), color: 'error' })
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

// ---- saving ----
const saving = ref(false)
async function save() {
  if (!form.title.trim()) return
  saving.value = true
  const body = {
    title: form.title,
    body: form.body,
    videoUrl: form.videoUrl.trim() || null,
    task: withTask.value && form.testId ? { testId: form.testId, skill: form.skill, partNumber: form.part || null } : null,
    files: form.files
  }
  try {
    const id = props.lesson
      ? (await $fetch<{ id: string }>(`/api/course-lessons/${props.lesson.id}`, { method: 'PATCH', body })).id
      : (await $fetch<{ id: string }>(`/api/courses/${props.courseId}/lessons`, { method: 'POST', body })).id
    toast.add({ title: t('courses.lessonSaved'), color: 'success' })
    emit('saved', id)
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

// ---- the online class (a saved lesson) ----
const connected = ref(false)
const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
const live = reactive({ startsAt: local(new Date(Math.ceil(Date.now() / 3_600_000) * 3_600_000 + 864e5)), durationMinutes: 60 })
const liveBusy = ref(false)
async function makeLive() {
  if (!props.lesson) return
  liveBusy.value = true
  try {
    await $fetch(`/api/course-lessons/${props.lesson.id}/live`, { method: 'POST', body: { startsAt: new Date(live.startsAt).toISOString(), durationMinutes: live.durationMinutes } })
    toast.add({ title: t('online.scheduled'), description: t('online.toldText'), color: 'success' })
    emit('saved', props.lesson.id)
  } catch (e) {
    toast.add({ title: t('online.notScheduled'), description: errorMessage(e), color: 'error' })
  } finally {
    liveBusy.value = false
  }
}
async function cancelLive() {
  if (!props.lesson?.live || !confirm(t('online.cancelSure', { title: props.lesson.live.title }))) return
  await $fetch(`/api/live-lessons/${props.lesson.live.id}`, { method: 'DELETE' }).catch(e => toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' }))
  emit('saved', props.lesson.id)
}
</script>

<template>
  <form
    class="grid gap-5"
    data-testid="lesson-editor"
    @submit.prevent="save"
  >
    <UFormField :label="t('courses.lessonTitle')">
      <UInput
        v-model="form.title"
        class="w-full"
        autofocus
        data-testid="lesson-title"
      />
    </UFormField>

    <UFormField :label="t('courses.text')">
      <BuilderRichEditor
        v-model="form.body"
        toolbar="full"
        :placeholder="t('courses.textPlaceholder')"
      />
    </UFormField>

    <UFormField
      :label="t('courses.video')"
      :help="t('courses.videoHelp')"
    >
      <UInput
        v-model="form.videoUrl"
        placeholder="https://www.youtube.com/watch?v=…"
        icon="i-lucide-play-circle"
        class="w-full"
      />
    </UFormField>

    <div class="flex flex-col gap-3 rounded-lg ring ring-default p-3">
      <USwitch
        v-model="withTask"
        :label="t('courses.withTask')"
        :description="t('courses.withTaskText')"
      />
      <div
        v-if="withTask"
        class="grid sm:grid-cols-3 gap-3"
      >
        <UFormField
          :label="t('mocks.test')"
          class="sm:col-span-3"
        >
          <USelectMenu
            v-model="form.testId"
            :items="testItems"
            value-key="value"
            :placeholder="t('centre.pickTest')"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('centre.section')">
          <USelect
            v-model="form.skill"
            :items="skillItems"
            class="w-full"
          />
        </UFormField>
        <UFormField
          :label="t('courses.part')"
          class="sm:col-span-2"
        >
          <USelect
            v-model="form.part"
            :items="partItems"
            class="w-full"
          />
        </UFormField>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm font-medium text-highlighted">
          {{ t('courses.files') }}
        </p>
        <UButton
          :label="t('courses.addPdf')"
          icon="i-lucide-upload"
          size="sm"
          color="neutral"
          variant="outline"
          :loading="uploading"
          @click="fileInput?.click()"
        />
        <input
          ref="fileInput"
          type="file"
          accept="application/pdf"
          multiple
          class="hidden"
          @change="addFiles"
        >
      </div>
      <div
        v-for="(f, i) in form.files"
        :key="f.url"
        class="flex items-center gap-2"
      >
        <UIcon
          name="i-lucide-file-text"
          class="size-5 text-error shrink-0"
        />
        <UInput
          v-model="f.name"
          size="sm"
          class="flex-1"
        />
        <UButton
          icon="i-lucide-x"
          size="sm"
          color="neutral"
          variant="ghost"
          :aria-label="t('words.remove')"
          @click="form.files.splice(i, 1)"
        />
      </div>
    </div>

    <div
      v-if="lesson"
      class="flex flex-col gap-3 rounded-lg ring ring-default p-3"
    >
      <p class="text-sm font-medium text-highlighted flex items-center gap-2">
        <UIcon name="i-lucide-video" />{{ t('courses.liveTitle') }}
      </p>
      <template v-if="lesson.live && lesson.live.status === 'SCHEDULED'">
        <OnlineRow
          :lesson="lesson.live"
          manage
          @cancel="cancelLive"
        />
      </template>
      <template v-else>
        <OnlineGoogleConnect
          :next="`${route.path}?lesson=${lesson.id}`"
          @change="c => connected = c"
        />
        <div class="grid grid-cols-2 gap-3">
          <UFormField
            :label="t('online.startsAt')"
            :help="t('online.yourTime')"
          >
            <UInput
              v-model="live.startsAt"
              type="datetime-local"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('online.duration')">
            <UInputNumber
              v-model="live.durationMinutes"
              :min="10"
              :max="240"
              :step="5"
              class="w-full"
            />
          </UFormField>
        </div>
        <UButton
          :label="t('courses.makeLive')"
          icon="i-logos-google-meet"
          color="neutral"
          variant="outline"
          class="self-start"
          :disabled="!connected"
          :loading="liveBusy"
          @click="makeLive"
        />
      </template>
    </div>
    <p
      v-else
      class="text-xs text-muted"
    >
      {{ t('courses.liveAfterSave') }}
    </p>

    <div class="flex justify-end gap-2 sticky bottom-0 bg-default py-2">
      <UButton
        :label="t('common.cancel')"
        color="neutral"
        variant="ghost"
        @click="emit('close')"
      />
      <UButton
        type="submit"
        :label="t('courses.saveLesson')"
        :loading="saving"
        :disabled="!form.title.trim()"
        data-testid="lesson-save"
      />
    </div>
  </form>
</template>
