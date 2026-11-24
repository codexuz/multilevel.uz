<script setup lang="ts">
import type { CourseCard } from '~/components/course/Card.vue'
import type { EditableLesson } from '~/components/course/LessonEditor.vue'

/**
 * A course for its teacher: its lessons (written, reordered, removed), its details (who sees it:
 * private for the teacher's classes, or public in the catalogue; published or a draft), and its
 * learners with how far each has got.
 */
interface Manage extends Omit<CourseCard, 'lessons'> { lessons: EditableLesson[], tasks: number, learners: number, learnerList?: never }
interface Learner { id: string, name: string, avatarUrl: string | null, done: number, tasksDone: number }

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const id = String(route.params.id)
const { data: c, error, refresh } = await useFetch<Omit<Manage, 'learners'> & { learners: Learner[], learnersCount?: number }>(`/api/courses/${id}/manage`)
if (error.value || !c.value) throw createError({ statusCode: 404, statusMessage: t('courses.notFound'), fatal: true })
useSeoMeta({ title: () => c.value?.title ?? t('nav.courses'), robots: 'noindex' })

const tab = ref<'lessons' | 'details' | 'learners'>('lessons')
const tabs = computed(() => [
  { label: t('courses.lessonsTab', { n: c.value?.lessons.length ?? 0 }), value: 'lessons', icon: 'i-lucide-list-ordered' },
  { label: t('courses.detailsTab'), value: 'details', icon: 'i-lucide-settings-2' },
  { label: t('courses.learnersTab', { n: c.value?.learners.length ?? 0 }), value: 'learners', icon: 'i-lucide-users' }
])

// ---- details ----
const details = reactive({ title: '', summary: '', exam: 'NONE', level: 'NONE', visibility: 'PRIVATE', published: false })
watch(c, (v) => {
  if (v) Object.assign(details, { title: v.title, summary: v.summary ?? '', exam: v.exam ?? 'NONE', level: v.level ?? 'NONE', visibility: v.visibility, published: v.published })
}, { immediate: true })
const examItems = computed(() => [{ label: t('courses.anyExam'), value: 'NONE' }, { label: 'IELTS', value: 'IELTS' }, { label: 'Multilevel', value: 'MULTILEVEL' }])
const levelItems = computed(() => [{ label: t('courses.anyLevel'), value: 'NONE' }, ...['A1', 'A2', 'B1', 'B2', 'C1'].map(l => ({ label: l, value: l }))])
const visibilityItems = computed(() => [
  { label: t('courses.private'), description: t('courses.privateText'), value: 'PRIVATE' },
  { label: t('courses.public'), description: t('courses.publicText'), value: 'PUBLIC' }
])
const savingDetails = ref(false)
async function saveDetails(extra: Partial<typeof details> = {}) {
  savingDetails.value = true
  try {
    const d = { ...details, ...extra }
    await $fetch(`/api/courses/${id}`, { method: 'PATCH', body: { title: d.title, summary: d.summary, exam: d.exam === 'NONE' ? null : d.exam, level: d.level === 'NONE' ? null : d.level, visibility: d.visibility, published: d.published } })
    await refresh()
    toast.add({ title: t('courses.saved'), color: 'success' })
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    savingDetails.value = false
  }
}
async function togglePublished() {
  if (!c.value) return
  if (!c.value.published && !c.value.lessons.length) return toast.add({ title: t('courses.addLessonFirst'), color: 'warning' })
  await saveDetails({ published: !c.value.published })
}
async function removeCourse() {
  if (!confirm(t('courses.deleteSure', { title: c.value?.title }))) return
  await $fetch(`/api/courses/${id}`, { method: 'DELETE' })
  await router.push('/courses/manage')
}

// ---- lessons ----
const editing = ref<EditableLesson | null | 'new'>(null)
// Back from connecting Google: the lesson it was for opens again.
onMounted(() => {
  const l = route.query.lesson
  const found = typeof l === 'string' ? c.value?.lessons.find(x => x.id === l) : null
  if (found) editing.value = found
  if (route.query.google === 'connected') toast.add({ title: t('online.connectedToast'), color: 'success' })
})
async function onSaved(lessonId: string) {
  await refresh()
  // A lesson just made stays open, so its online class can be set; an edited one closes.
  const now = c.value?.lessons.find(x => x.id === lessonId) ?? null
  editing.value = editing.value === 'new' ? now : (now && editing.value && now.live?.id !== (editing.value as EditableLesson).live?.id ? now : null)
}
async function move(i: number, by: -1 | 1) {
  const list = [...(c.value?.lessons ?? [])]
  const j = i + by
  if (j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j]!, list[i]!]
  try {
    await $fetch(`/api/courses/${id}/lessons/order`, { method: 'POST', body: { ids: list.map(l => l.id) } })
    await refresh()
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  }
}
async function removeLesson(l: EditableLesson) {
  if (!confirm(t('courses.deleteLessonSure', { title: l.title }))) return
  await $fetch(`/api/course-lessons/${l.id}`, { method: 'DELETE' }).catch(e => toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' }))
  await refresh()
}
const icons = (l: EditableLesson) => [
  l.body && 'i-lucide-file-text', l.videoUrl && 'i-lucide-play-circle', l.task && 'i-lucide-clipboard-check', l.files.length && 'i-lucide-paperclip', l.live?.status === 'SCHEDULED' && 'i-lucide-video'
].filter(Boolean) as string[]
const lessonCount = computed(() => c.value?.lessons.length ?? 0)
</script>

<template>
  <AppPage
    v-if="c"
    :title="c.title"
    icon="i-lucide-pencil-ruler"
    back="/courses/manage"
  >
    <template #actions>
      <UButton
        :to="`/courses/${c.slug}`"
        :label="t('courses.view')"
        icon="i-lucide-eye"
        color="neutral"
        variant="ghost"
      />
      <UButton
        :label="c.published ? t('courses.unpublish') : t('courses.publish')"
        :icon="c.published ? 'i-lucide-eye-off' : 'i-lucide-rocket'"
        :color="c.published ? 'neutral' : 'primary'"
        :variant="c.published ? 'outline' : 'solid'"
        :loading="savingDetails"
        data-testid="publish"
        @click="togglePublished"
      />
    </template>

    <div class="flex flex-col gap-4 max-w-4xl w-full">
      <UAlert
        :color="c.published ? 'success' : 'neutral'"
        variant="subtle"
        :icon="c.visibility === 'PUBLIC' ? 'i-lucide-globe' : 'i-lucide-lock'"
        :title="c.published ? (c.visibility === 'PUBLIC' ? t('courses.livepublic') : t('courses.liveprivate')) : t('courses.draftText')"
      />

      <UTabs
        v-model="tab"
        :items="tabs"
        :content="false"
        class="w-full sm:w-auto"
      />

      <!-- Lessons -->
      <template v-if="tab === 'lessons'">
        <ol
          v-if="c.lessons.length"
          class="rounded-xl ring ring-default divide-y divide-default overflow-hidden"
        >
          <li
            v-for="(l, i) in c.lessons"
            :key="l.id"
            class="flex items-center gap-3 px-4 py-3"
            data-testid="manage-lesson"
          >
            <span class="size-7 shrink-0 rounded-full bg-elevated grid place-items-center text-xs font-semibold">{{ i + 1 }}</span>
            <button
              type="button"
              class="flex-1 min-w-0 text-start"
              @click="editing = l"
            >
              <span class="block font-medium text-highlighted truncate">{{ l.title }}</span>
              <span class="flex items-center gap-1.5 text-muted mt-0.5">
                <UIcon
                  v-for="ic in icons(l)"
                  :key="ic"
                  :name="ic"
                  class="size-3.5"
                />
              </span>
            </button>
            <UButton
              icon="i-lucide-arrow-up"
              size="xs"
              color="neutral"
              variant="ghost"
              :disabled="i === 0"
              :aria-label="t('courses.up')"
              @click="move(i, -1)"
            />
            <UButton
              icon="i-lucide-arrow-down"
              size="xs"
              color="neutral"
              variant="ghost"
              :disabled="i === lessonCount - 1"
              :aria-label="t('courses.down')"
              @click="move(i, 1)"
            />
            <UButton
              icon="i-lucide-trash-2"
              size="xs"
              color="neutral"
              variant="ghost"
              :aria-label="t('words.remove')"
              @click="removeLesson(l)"
            />
          </li>
        </ol>
        <UEmpty
          v-else
          icon="i-lucide-list-plus"
          :title="t('courses.noLessonsYet')"
          :description="t('courses.noLessonsYetText')"
          variant="naked"
        />
        <UButton
          :label="t('courses.addLesson')"
          icon="i-lucide-plus"
          class="self-start"
          data-testid="add-lesson"
          @click="editing = 'new'"
        />
      </template>

      <!-- Details -->
      <UCard v-else-if="tab === 'details'">
        <form
          class="grid gap-4"
          @submit.prevent="saveDetails()"
        >
          <UFormField :label="t('courses.titleLabel')">
            <UInput
              v-model="details.title"
              class="w-full"
            />
          </UFormField>
          <UFormField
            :label="t('courses.summary')"
            :help="t('courses.summaryHelp')"
          >
            <UTextarea
              v-model="details.summary"
              :rows="3"
              :maxlength="400"
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField :label="t('courses.exam')">
              <USelect
                v-model="details.exam"
                :items="examItems"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('courses.level')">
              <USelect
                v-model="details.level"
                :items="levelItems"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField :label="t('courses.whoSees')">
            <URadioGroup
              v-model="details.visibility"
              :items="visibilityItems"
              variant="card"
            />
          </UFormField>
          <div class="flex flex-wrap justify-between gap-2">
            <UButton
              :label="t('courses.delete')"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              @click="removeCourse"
            />
            <UButton
              type="submit"
              :label="t('courses.save')"
              :loading="savingDetails"
            />
          </div>
        </form>
      </UCard>

      <!-- Learners -->
      <template v-else>
        <p class="text-sm text-muted">
          {{ c.visibility === 'PUBLIC' ? t('courses.learnersPublic') : t('courses.learnersPrivate') }}
        </p>
        <div
          v-if="c.learners.length"
          class="rounded-xl ring ring-default divide-y divide-default overflow-hidden"
        >
          <div
            v-for="u in c.learners"
            :key="u.id"
            class="flex items-center gap-3 px-4 py-3"
            data-testid="learner-row"
          >
            <UAvatar
              :src="u.avatarUrl ?? undefined"
              :alt="u.name"
              size="sm"
            />
            <span class="flex-1 min-w-0 font-medium truncate">{{ u.name }}</span>
            <span class="text-sm text-muted tabular-nums">{{ t('courses.learnerDone', { done: u.done, of: lessonCount }) }}</span>
            <span
              v-if="c.tasks"
              class="text-sm text-muted tabular-nums"
            >· {{ t('courses.learnerTasks', { done: u.tasksDone, of: c.tasks }) }}</span>
            <UProgress
              :model-value="lessonCount ? Math.round(u.done / lessonCount * 100) : 0"
              size="xs"
              class="w-24 max-sm:hidden"
            />
          </div>
        </div>
        <UEmpty
          v-else
          icon="i-lucide-users"
          :title="t('courses.noLearners')"
          variant="naked"
        />
      </template>
    </div>

    <UModal
      :open="!!editing"
      :title="editing === 'new' ? t('courses.addLesson') : t('courses.editLesson')"
      fullscreen
      @update:open="v => !v && (editing = null)"
    >
      <template #body>
        <div class="max-w-3xl mx-auto w-full">
          <CourseLessonEditor
            v-if="editing"
            :key="editing === 'new' ? 'new' : `${editing.id}:${editing.live?.id ?? ''}:${editing.live?.status ?? ''}`"
            :course-id="c.id"
            :lesson="editing === 'new' ? null : editing"
            @saved="onSaved"
            @close="editing = null"
          />
        </div>
      </template>
    </UModal>
  </AppPage>
</template>
