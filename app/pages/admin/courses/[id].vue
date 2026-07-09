<script setup lang="ts">
import type { AdminCourseTreeDto, AdminLessonDto, LessonAttachment } from '~/types/models'
import { LESSON_TYPE_META, type LessonType } from '~/types/exam'

definePageMeta({ layout: 'admin', middleware: 'staff' })

const route = useRoute()
const toast = useToast()
const { confirm } = useConfirm()
const id = route.params.id as string

const { data: tree, refresh } = await useFetch<AdminCourseTreeDto>(`/api/admin/courses/${id}`)
if (!tree.value) throw createError({ statusCode: 404, statusMessage: 'Course not found' })

function errMsg(e: unknown) {
  return (e as { data?: { message?: string } })?.data?.message ?? 'Failed'
}

// ---- Course meta ----
const meta = reactive({
  title: tree.value.course.title,
  description: tree.value.course.description ?? '',
  level: tree.value.course.level ?? '',
  category: tree.value.course.category ?? '',
  thumbnailUrl: tree.value.course.thumbnailUrl ?? '',
  estimatedMinutes: tree.value.course.estimatedMinutes ?? undefined,
  isPremium: tree.value.course.isPremium
})
const savingMeta = ref(false)
async function saveMeta() {
  savingMeta.value = true
  try {
    await $fetch(`/api/admin/courses/${id}`, {
      method: 'PATCH',
      body: {
        title: meta.title,
        description: meta.description || null,
        level: meta.level || null,
        category: meta.category || null,
        thumbnailUrl: meta.thumbnailUrl || null,
        estimatedMinutes: meta.estimatedMinutes ? Number(meta.estimatedMinutes) : null,
        isPremium: meta.isPremium
      }
    })
    toast.add({ title: 'Saved', color: 'success' })
    await refresh()
  } catch (e) {
    toast.add({ title: errMsg(e), color: 'error' })
  } finally {
    savingMeta.value = false
  }
}

const published = computed(() => tree.value?.course.status === 'published')
async function togglePublish() {
  try {
    await $fetch(`/api/admin/courses/${id}`, {
      method: 'PATCH',
      body: { status: published.value ? 'draft' : 'published' }
    })
    await refresh()
  } catch (e) {
    toast.add({ title: errMsg(e), color: 'error' })
  }
}

// ---- Modules ----
async function addModule() {
  try {
    await $fetch('/api/admin/modules', { method: 'POST', body: { courseId: id } })
    await refresh()
  } catch (e) {
    toast.add({ title: errMsg(e), color: 'error' })
  }
}
async function renameModule(moduleId: string, title: string) {
  try {
    await $fetch(`/api/admin/modules/${moduleId}`, { method: 'PATCH', body: { title } })
  } catch (e) {
    toast.add({ title: errMsg(e), color: 'error' })
  }
}
async function deleteModule(moduleId: string, title: string) {
  if (!await confirm({ title: `Delete module "${title}"?`, description: 'All its lessons will be removed.', confirmLabel: 'Delete', color: 'error' })) return
  try {
    await $fetch(`/api/admin/modules/${moduleId}`, { method: 'DELETE' })
    await refresh()
  } catch (e) {
    toast.add({ title: errMsg(e), color: 'error' })
  }
}

// ---- Lessons ----
async function addLesson(moduleId: string) {
  try {
    const lesson = await $fetch<AdminLessonDto>('/api/admin/lessons', { method: 'POST', body: { moduleId } })
    await refresh()
    openLesson(lesson)
  } catch (e) {
    toast.add({ title: errMsg(e), color: 'error' })
  }
}
async function deleteLesson(lessonId: string, title: string) {
  if (!await confirm({ title: `Delete lesson "${title}"?`, confirmLabel: 'Delete', color: 'error' })) return
  try {
    await $fetch(`/api/admin/lessons/${lessonId}`, { method: 'DELETE' })
    await refresh()
  } catch (e) {
    toast.add({ title: errMsg(e), color: 'error' })
  }
}

// ---- Lesson editor modal ----
const editorOpen = ref(false)
const savingLesson = ref(false)
const lessonTypes: LessonType[] = ['video', 'article', 'quiz']
const edit = reactive({
  id: '',
  title: '',
  type: 'article' as LessonType,
  content: '',
  videoUrl: '',
  durationMinutes: 5,
  isPreview: false,
  attachments: [] as LessonAttachment[]
})
function openLesson(l: AdminLessonDto) {
  edit.id = l.id
  edit.title = l.title
  edit.type = l.type
  edit.content = l.content ?? ''
  edit.videoUrl = l.videoUrl ?? ''
  edit.durationMinutes = l.durationMinutes
  edit.isPreview = l.isPreview
  edit.attachments = l.attachments ? l.attachments.map(a => ({ ...a })) : []
  editorOpen.value = true
}
function addAttachment() {
  edit.attachments.push({ label: '', url: '' })
}
async function saveLesson() {
  savingLesson.value = true
  try {
    await $fetch(`/api/admin/lessons/${edit.id}`, {
      method: 'PATCH',
      body: {
        title: edit.title,
        type: edit.type,
        content: edit.content || null,
        videoUrl: edit.videoUrl || null,
        durationMinutes: Number(edit.durationMinutes) || 1,
        isPreview: edit.isPreview,
        attachments: edit.attachments.filter(a => a.label && a.url)
      }
    })
    editorOpen.value = false
    toast.add({ title: 'Lesson saved', color: 'success' })
    await refresh()
  } catch (e) {
    toast.add({ title: errMsg(e), color: 'error' })
  } finally {
    savingLesson.value = false
  }
}
</script>

<template>
  <div
    v-if="tree"
    class="space-y-6"
  >
    <div class="flex items-center gap-3">
      <UButton
        to="/admin/courses"
        icon="i-lucide-arrow-left"
        variant="ghost"
        color="neutral"
      />
      <h1 class="text-2xl font-bold flex-1 truncate">
        {{ tree.course.title }}
      </h1>
      <UBadge
        :color="published ? 'success' : 'neutral'"
        variant="subtle"
        :label="tree.course.status"
      />
      <UButton
        :color="published ? 'neutral' : 'primary'"
        :variant="published ? 'outline' : 'solid'"
        :icon="published ? 'i-lucide-eye-off' : 'i-lucide-globe'"
        :label="published ? 'Unpublish' : 'Publish'"
        @click="togglePublish"
      />
      <UButton
        :to="`/courses/${id}`"
        target="_blank"
        icon="i-lucide-external-link"
        variant="ghost"
        color="neutral"
        label="Preview"
      />
    </div>

    <!-- Course settings -->
    <UCard :ui="{ body: 'space-y-4' }">
      <template #header>
        <h2 class="font-semibold">
          Course settings
        </h2>
      </template>
      <UFormField
        label="Title"
        required
      >
        <UInput
          v-model="meta.title"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Description">
        <UTextarea
          v-model="meta.description"
          class="w-full"
          :rows="2"
        />
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-3">
        <UFormField label="Level">
          <USelect
            v-model="meta.level"
            :items="['A2', 'B1', 'B2', 'C1']"
            placeholder="No level"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Category">
          <UInput
            v-model="meta.category"
            class="w-full"
            placeholder="Grammar"
          />
        </UFormField>
        <UFormField label="Est. minutes">
          <UInput
            v-model="meta.estimatedMinutes"
            type="number"
            class="w-full"
            placeholder="120"
          />
        </UFormField>
      </div>
      <UFormField label="Thumbnail URL">
        <UInput
          v-model="meta.thumbnailUrl"
          class="w-full"
          placeholder="https://…"
        />
      </UFormField>
      <UFormField
        label="Premium"
        description="Require an active subscription to enroll"
      >
        <USwitch v-model="meta.isPremium" />
      </UFormField>
      <template #footer>
        <UButton
          :loading="savingMeta"
          label="Save settings"
          icon="i-lucide-save"
          @click="saveMeta"
        />
      </template>
    </UCard>

    <!-- Curriculum -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold">
        Curriculum
      </h2>
      <UButton
        icon="i-lucide-plus"
        variant="subtle"
        label="Add module"
        @click="addModule"
      />
    </div>

    <UAlert
      v-if="!tree.modules.length"
      icon="i-lucide-inbox"
      color="neutral"
      variant="subtle"
      title="No modules yet"
      description="Add a module to start building the curriculum."
    />

    <UCard
      v-for="(m, mi) in tree.modules"
      :key="m.id"
      :ui="{ body: 'p-0 sm:p-0' }"
    >
      <template #header>
        <div class="flex items-center gap-2">
          <span class="text-muted text-sm font-mono">{{ mi + 1 }}</span>
          <UInput
            :model-value="m.title"
            variant="ghost"
            class="flex-1 font-semibold"
            @blur="(e: FocusEvent) => renameModule(m.id, (e.target as HTMLInputElement).value)"
          />
          <UButton
            icon="i-lucide-plus"
            size="xs"
            variant="subtle"
            label="Lesson"
            @click="addLesson(m.id)"
          />
          <UButton
            icon="i-lucide-trash-2"
            size="xs"
            variant="ghost"
            color="error"
            @click="deleteModule(m.id, m.title)"
          />
        </div>
      </template>

      <div
        v-if="m.lessons.length"
        class="divide-y divide-default"
      >
        <div
          v-for="(l, li) in m.lessons"
          :key="l.id"
          class="flex items-center gap-3 p-3"
        >
          <span class="text-xs text-muted font-mono w-6 text-center">{{ mi + 1 }}.{{ li + 1 }}</span>
          <UIcon
            :name="LESSON_TYPE_META[l.type].icon"
            class="size-4 text-muted shrink-0"
          />
          <button
            class="flex-1 min-w-0 text-left text-sm font-medium hover:text-primary truncate"
            @click="openLesson(l)"
          >
            {{ l.title }}
          </button>
          <UBadge
            v-if="l.isPreview"
            color="info"
            variant="subtle"
            size="sm"
            label="Preview"
          />
          <span class="text-xs text-muted">{{ l.durationMinutes }}m</span>
          <UButton
            icon="i-lucide-pencil"
            size="xs"
            variant="ghost"
            color="neutral"
            @click="openLesson(l)"
          />
          <UButton
            icon="i-lucide-trash-2"
            size="xs"
            variant="ghost"
            color="error"
            @click="deleteLesson(l.id, l.title)"
          />
        </div>
      </div>
      <p
        v-else
        class="text-sm text-muted p-4"
      >
        No lessons in this module yet.
      </p>
    </UCard>

    <!-- Lesson editor -->
    <UModal
      v-model:open="editorOpen"
      title="Edit lesson"
      :ui="{ content: 'max-w-2xl' }"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField
            label="Title"
            required
          >
            <UInput
              v-model="edit.title"
              class="w-full"
            />
          </UFormField>
          <div class="grid gap-4 sm:grid-cols-3">
            <UFormField label="Type">
              <USelect
                v-model="edit.type"
                :items="lessonTypes.map(t => ({ label: LESSON_TYPE_META[t].label, value: t }))"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Duration (min)">
              <UInput
                v-model="edit.durationMinutes"
                type="number"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Free preview"
              description="View without enrolling"
            >
              <USwitch v-model="edit.isPreview" />
            </UFormField>
          </div>
          <UFormField
            v-if="edit.type === 'video'"
            label="Video URL"
            description="YouTube, Vimeo or direct .mp4"
          >
            <UInput
              v-model="edit.videoUrl"
              class="w-full"
              placeholder="https://youtube.com/watch?v=…"
            />
          </UFormField>
          <UFormField
            label="Content"
            description="HTML is rendered as-is in the lesson body"
          >
            <UTextarea
              v-model="edit.content"
              class="w-full font-mono text-sm"
              :rows="10"
              placeholder="<p>Lesson text…</p>"
            />
          </UFormField>

          <UFormField label="Attachments">
            <div class="space-y-2">
              <div
                v-for="(a, i) in edit.attachments"
                :key="i"
                class="flex gap-2"
              >
                <UInput
                  v-model="a.label"
                  placeholder="Label"
                  class="flex-1"
                />
                <UInput
                  v-model="a.url"
                  placeholder="https://…"
                  class="flex-1"
                />
                <UButton
                  icon="i-lucide-x"
                  variant="ghost"
                  color="error"
                  @click="() => { edit.attachments.splice(i, 1) }"
                />
              </div>
              <UButton
                icon="i-lucide-plus"
                size="xs"
                variant="subtle"
                label="Add attachment"
                @click="addAttachment"
              />
            </div>
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            variant="ghost"
            color="neutral"
            label="Cancel"
            @click="() => { editorOpen = false }"
          />
          <UButton
            :loading="savingLesson"
            label="Save lesson"
            icon="i-lucide-check"
            @click="saveLesson"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
