<script setup lang="ts">
import type { CourseCard } from '~/components/course/Card.vue'
import type { EditableLesson } from '~/components/course/LessonEditor.vue'

/**
 * Full LMS Course Studio:
 * Course => Units/Modules => Lessons => Interactive Exercises => Questions (12 types),
 * plus Content Drip (Always Open, Date From-To, Sequential) and Learner Analytics.
 */
interface ModuleDto {
  id: string
  position: number
  title: string
  description: string | null
  dripMode: string | null
  availableFrom: string | null
  availableTo: string | null
}
interface Learner {
  id: string
  name: string
  avatarUrl: string | null
  done: number
  tasksDone: number
  exercisesPassed: number
  avgExerciseScore: number | null
}
interface ManageCourse extends Omit<CourseCard, 'lessons' | 'learners'> {
  dripMode: DripMode
  dripStartAt: string | null
  dripEndAt: string | null
  passingScore: number
  modules: ModuleDto[]
  lessons: EditableLesson[]
  tasks: number
  exerciseTotal: number
  learners: Learner[]
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const id = String(route.params.id)
const backPath = computed(() => (route.query.panel === 'admin' ? '/admin/courses' : '/teacher/courses'))

const { data: c, error, refresh } = await useFetch<ManageCourse>(`/api/courses/${id}/manage`)
if (error.value || !c.value) throw createError({ statusCode: 404, statusMessage: t('courses.notFound'), fatal: true })
useSeoMeta({ title: () => c.value?.title ?? t('nav.courses'), robots: 'noindex' })

const tab = ref<'curriculum' | 'drip' | 'learners'>('curriculum')
const tabs = computed(() => [
  { label: `Curriculum (${c.value?.modules.length ?? 0} units · ${c.value?.lessons.length ?? 0} lessons)`, value: 'curriculum', icon: 'i-lucide-layers' },
  { label: 'Details & Content Drip', value: 'drip', icon: 'i-lucide-calendar-clock' },
  { label: `Learners (${c.value?.learners.length ?? 0})`, value: 'learners', icon: 'i-lucide-users' }
])

const toLocalInput = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

// ---- Course Details & Drip ----
const details = reactive({
  title: '',
  summary: '',
  exam: 'NONE',
  level: 'NONE',
  visibility: 'PRIVATE',
  published: false,
  dripMode: 'ALWAYS_OPEN' as DripMode,
  dripStartAt: '',
  dripEndAt: '',
  passingScore: 70
})
watch(c, (v) => {
  if (!v) return
  Object.assign(details, {
    title: v.title,
    summary: v.summary ?? '',
    exam: v.exam ?? 'NONE',
    level: v.level ?? 'NONE',
    visibility: v.visibility,
    published: v.published,
    dripMode: v.dripMode ?? 'ALWAYS_OPEN',
    dripStartAt: toLocalInput(v.dripStartAt),
    dripEndAt: toLocalInput(v.dripEndAt),
    passingScore: v.passingScore ?? 70
  })
}, { immediate: true })

const examItems = computed(() => [{ label: t('courses.anyExam'), value: 'NONE' }, { label: 'IELTS', value: 'IELTS' }, { label: 'Multilevel (CEFR)', value: 'MULTILEVEL' }])
const levelItems = computed(() => [{ label: t('courses.anyLevel'), value: 'NONE' }, ...['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(l => ({ label: l, value: l }))])
const visibilityItems = computed(() => [
  { label: t('courses.private'), description: t('courses.privateText'), value: 'PRIVATE' },
  { label: t('courses.public'), description: t('courses.publicText'), value: 'PUBLIC' }
])
const dripOptions = DRIP_MODES.map(m => ({ label: DRIP_MODE_META[m].label, description: DRIP_MODE_META[m].description, value: m }))

const savingDetails = ref(false)
async function saveDetails(extra: Partial<typeof details> = {}) {
  savingDetails.value = true
  try {
    const d = { ...details, ...extra }
    await $fetch(`/api/courses/${id}`, {
      method: 'PATCH',
      body: {
        title: d.title,
        summary: d.summary,
        exam: d.exam === 'NONE' ? null : d.exam,
        level: d.level === 'NONE' ? null : d.level,
        visibility: d.visibility,
        published: d.published,
        dripMode: d.dripMode,
        dripStartAt: d.dripStartAt ? new Date(d.dripStartAt).toISOString() : null,
        dripEndAt: d.dripEndAt ? new Date(d.dripEndAt).toISOString() : null,
        passingScore: d.passingScore
      }
    })
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
  await router.push(backPath.value)
}

// ---- Units / Modules CRUD ----
const moduleModalOpen = ref(false)
const editingModule = ref<ModuleDto | null>(null)
const savingModule = ref(false)
const modForm = reactive({ title: '', description: '', dripMode: 'INHERIT', availableFrom: '', availableTo: '' })

function openNewModule() {
  editingModule.value = null
  Object.assign(modForm, { title: '', description: '', dripMode: 'INHERIT', availableFrom: '', availableTo: '' })
  moduleModalOpen.value = true
}
function openEditModule(m: ModuleDto) {
  editingModule.value = m
  Object.assign(modForm, {
    title: m.title,
    description: m.description ?? '',
    dripMode: m.dripMode ?? 'INHERIT',
    availableFrom: toLocalInput(m.availableFrom),
    availableTo: toLocalInput(m.availableTo)
  })
  moduleModalOpen.value = true
}
async function saveModule() {
  if (!modForm.title.trim()) return
  savingModule.value = true
  const body = {
    title: modForm.title,
    description: modForm.description.trim() || null,
    dripMode: modForm.dripMode === 'INHERIT' ? null : modForm.dripMode,
    availableFrom: modForm.availableFrom ? new Date(modForm.availableFrom).toISOString() : null,
    availableTo: modForm.availableTo ? new Date(modForm.availableTo).toISOString() : null
  }
  try {
    if (editingModule.value) {
      await $fetch(`/api/course-modules/${editingModule.value.id}`, { method: 'PATCH', body })
    } else {
      await $fetch(`/api/courses/${id}/modules`, { method: 'POST', body })
    }
    moduleModalOpen.value = false
    await refresh()
    toast.add({ title: editingModule.value ? 'Unit updated' : 'Unit added', color: 'success' })
  } catch (e) {
    toast.add({ title: 'Could not save unit', description: errorMessage(e), color: 'error' })
  } finally {
    savingModule.value = false
  }
}
async function moveModule(idx: number, delta: -1 | 1) {
  const list = [...(c.value?.modules ?? [])]
  const j = idx + delta
  if (j < 0 || j >= list.length) return
  ;[list[idx], list[j]] = [list[j]!, list[idx]!]
  await $fetch(`/api/courses/${id}/modules/order`, { method: 'POST', body: { ids: list.map(m => m.id) } })
  await refresh()
}
async function deleteModule(m: ModuleDto) {
  if (!confirm(`Delete unit "${m.title}"? Its lessons will remain in the course as ungrouped.`)) return
  await $fetch(`/api/course-modules/${m.id}`, { method: 'DELETE' })
  await refresh()
}

// ---- Lessons CRUD ----
const editingLesson = ref<EditableLesson | null | 'new'>(null)
const targetModuleId = ref<string | null>(null)
const lessonModalOpen = computed({
  get: () => editingLesson.value !== null,
  set: (v: boolean) => { if (!v) editingLesson.value = null }
})

function openNewLesson(moduleId: string | null) {
  targetModuleId.value = moduleId
  editingLesson.value = 'new'
}

onMounted(() => {
  const l = route.query.lesson
  const found = typeof l === 'string' ? c.value?.lessons.find(x => x.id === l) : null
  if (found) editingLesson.value = found
  if (route.query.google === 'connected') toast.add({ title: t('online.connectedToast'), color: 'success' })
})

async function onLessonSaved(lessonId: string) {
  await refresh()
  const now = c.value?.lessons.find(x => x.id === lessonId) ?? null
  editingLesson.value = editingLesson.value === 'new' ? now : (now && editingLesson.value && now.live?.id !== (editingLesson.value as EditableLesson).live?.id ? now : null)
}
async function moveLessonInGroup(list: EditableLesson[], moduleId: string | null, i: number, delta: -1 | 1) {
  const copy = [...list]
  const j = i + delta
  if (j < 0 || j >= copy.length) return
  ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  await $fetch(`/api/courses/${id}/lessons/order`, { method: 'POST', body: { ids: copy.map(l => l.id), moduleId } })
  await refresh()
}
async function removeLesson(l: EditableLesson) {
  if (!confirm(t('courses.deleteLessonSure', { title: l.title }))) return
  await $fetch(`/api/course-lessons/${l.id}`, { method: 'DELETE' })
  await refresh()
}

// ---- Exercises CRUD ----
const creatingExerciseLesson = ref<EditableLesson | null>(null)
const newExerciseTitle = ref('')
const newExerciseType = ref<'PRACTICE' | 'QUIZ' | 'HOMEWORK'>('PRACTICE')
const savingExercise = ref(false)
const activeExerciseId = ref<string | null>(null)
const activeExerciseTitle = ref('')
const exerciseStudioOpen = computed({
  get: () => !!activeExerciseId.value,
  set: (v: boolean) => { if (!v) activeExerciseId.value = null }
})

function openNewExercise(l: EditableLesson) {
  creatingExerciseLesson.value = l
  newExerciseTitle.value = ''
  newExerciseType.value = 'PRACTICE'
}
async function createExercise() {
  if (!creatingExerciseLesson.value || !newExerciseTitle.value.trim()) return
  savingExercise.value = true
  try {
    const created = await $fetch<{ id: string, title: string }>(`/api/course-lessons/${creatingExerciseLesson.value.id}/exercises`, {
      method: 'POST',
      body: { title: newExerciseTitle.value, exerciseType: newExerciseType.value, passingScore: c.value?.passingScore ?? 70 }
    })
    creatingExerciseLesson.value = null
    await refresh()
    activeExerciseId.value = created.id
    activeExerciseTitle.value = created.title
  } catch (e) {
    toast.add({ title: 'Could not create exercise', description: errorMessage(e), color: 'error' })
  } finally {
    savingExercise.value = false
  }
}
async function deleteExercise(exId: string, title: string) {
  if (!confirm(`Delete exercise "${title}" and all its questions?`)) return
  await $fetch(`/api/course-exercises/${exId}`, { method: 'DELETE' })
  await refresh()
}

const lessonsInModule = (modId: string) => (c.value?.lessons ?? []).filter(l => l.moduleId === modId)
const ungroupedLessons = computed(() => {
  const modIds = new Set((c.value?.modules ?? []).map(m => m.id))
  return (c.value?.lessons ?? []).filter(l => !l.moduleId || !modIds.has(l.moduleId))
})
const icons = (l: EditableLesson) => [
  l.body && 'i-lucide-file-text',
  l.videoUrl && 'i-lucide-play-circle',
  l.task && 'i-lucide-clipboard-check',
  l.files.length && 'i-lucide-paperclip',
  l.live?.status === 'SCHEDULED' && 'i-lucide-video'
].filter(Boolean) as string[]
</script>

<template>
  <AppPage
    v-if="c"
    :title="c.title"
    icon="i-lucide-pencil-ruler"
    :back="backPath"
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

    <div class="flex flex-col gap-4 max-w-5xl w-full">
      <!-- Status & Content Drip Banner -->
      <div class="flex flex-wrap items-center gap-2">
        <UBadge
          :label="c.published ? 'Published' : 'Draft'"
          :color="c.published ? 'success' : 'neutral'"
          variant="subtle"
        />
        <UBadge
          :label="c.visibility === 'PUBLIC' ? 'Public Catalogue' : 'Private (My Groups)'"
          :icon="c.visibility === 'PUBLIC' ? 'i-lucide-globe' : 'i-lucide-lock'"
          color="neutral"
          variant="outline"
        />
        <UBadge
          :label="`Drip: ${DRIP_MODE_META[c.dripMode ?? 'ALWAYS_OPEN'].label}`"
          :icon="DRIP_MODE_META[c.dripMode ?? 'ALWAYS_OPEN'].icon"
          color="info"
          variant="soft"
        />
        <span class="text-xs text-muted ms-auto">
          {{ c.modules.length }} units · {{ c.lessons.length }} lessons · {{ c.exerciseTotal }} exercises
        </span>
      </div>

      <UTabs
        v-model="tab"
        :items="tabs"
        :content="false"
        class="w-full sm:w-auto"
      />

      <!-- CURRICULUM TREE: Units/Modules => Lessons => Exercises => Questions -->
      <template v-if="tab === 'curriculum'">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-xs text-muted">
            Organize your course into Units/Modules, add Lessons inside each unit, and attach interactive Exercises (12 question types).
          </p>
          <div class="flex items-center gap-2">
            <UButton
              label="Add Unit / Module"
              icon="i-lucide-folder-plus"
              size="sm"
              @click="openNewModule"
            />
            <UButton
              label="Quick Add Lesson"
              icon="i-lucide-plus"
              size="sm"
              color="neutral"
              variant="outline"
              data-testid="add-lesson"
              @click="openNewLesson(c.modules[0]?.id ?? null)"
            />
          </div>
        </div>

        <!-- Units List -->
        <div class="flex flex-col gap-4">
          <UCard
            v-for="(mod, mIdx) in c.modules"
            :key="mod.id"
            :ui="{ body: 'p-0' }"
          >
            <!-- Unit Header -->
            <div class="flex flex-wrap items-center gap-2 px-4 py-3 bg-elevated/50 border-b border-default">
              <UBadge
                :label="`Unit ${mIdx + 1}`"
                color="primary"
                variant="subtle"
                size="xs"
              />
              <div class="flex-1 min-w-44">
                <p class="font-semibold text-highlighted text-sm sm:text-base">
                  {{ mod.title }}
                </p>
                <p
                  v-if="mod.description"
                  class="text-xs text-muted"
                >
                  {{ mod.description }}
                </p>
              </div>
              <UBadge
                v-if="mod.dripMode || mod.availableFrom"
                :label="mod.dripMode ? DRIP_MODE_META[mod.dripMode as DripMode]?.label : 'Scheduled'"
                icon="i-lucide-calendar-clock"
                color="info"
                variant="soft"
                size="xs"
              />
              <div class="flex items-center gap-1">
                <UButton
                  label="Add Lesson"
                  icon="i-lucide-plus"
                  size="xs"
                  variant="soft"
                  @click="openNewLesson(mod.id)"
                />
                <UButton
                  icon="i-lucide-arrow-up"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  :disabled="mIdx === 0"
                  @click="moveModule(mIdx, -1)"
                />
                <UButton
                  icon="i-lucide-arrow-down"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  :disabled="mIdx === c.modules.length - 1"
                  @click="moveModule(mIdx, 1)"
                />
                <UButton
                  icon="i-lucide-settings-2"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  @click="openEditModule(mod)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  size="xs"
                  color="error"
                  variant="ghost"
                  @click="deleteModule(mod)"
                />
              </div>
            </div>

            <!-- Lessons inside Unit -->
            <ol
              v-if="lessonsInModule(mod.id).length"
              class="divide-y divide-default"
            >
              <li
                v-for="(l, lIdx) in lessonsInModule(mod.id)"
                :key="l.id"
                class="px-4 py-3 flex flex-col gap-2.5"
                data-testid="manage-lesson"
              >
                <div class="flex items-center gap-3">
                  <span class="size-7 shrink-0 rounded-full bg-elevated grid place-items-center text-xs font-semibold">{{ lIdx + 1 }}</span>
                  <button
                    type="button"
                    class="flex-1 min-w-0 text-start cursor-pointer"
                    @click="editingLesson = l"
                  >
                    <span class="block font-medium text-highlighted hover:text-primary truncate">{{ l.title }}</span>
                    <span class="flex flex-wrap items-center gap-2 text-xs text-muted mt-0.5">
                      <UIcon
                        v-for="ic in icons(l)"
                        :key="ic"
                        :name="ic"
                        class="size-3.5"
                      />
                      <span v-if="l.durationMinutes">{{ l.durationMinutes }} min</span>
                      <span
                        v-if="l.availableFrom"
                        class="text-info"
                      >Opens {{ new Date(l.availableFrom).toLocaleDateString() }}</span>
                    </span>
                  </button>
                  <UButton
                    label="Add Exercise"
                    icon="i-lucide-sparkles"
                    size="xs"
                    color="primary"
                    variant="subtle"
                    @click="openNewExercise(l)"
                  />
                  <UButton
                    icon="i-lucide-arrow-up"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    :disabled="lIdx === 0"
                    @click="moveLessonInGroup(lessonsInModule(mod.id), mod.id, lIdx, -1)"
                  />
                  <UButton
                    icon="i-lucide-arrow-down"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    :disabled="lIdx === lessonsInModule(mod.id).length - 1"
                    @click="moveLessonInGroup(lessonsInModule(mod.id), mod.id, lIdx, 1)"
                  />
                  <UButton
                    icon="i-lucide-pencil"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    @click="editingLesson = l"
                  />
                  <UButton
                    icon="i-lucide-trash-2"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    @click="removeLesson(l)"
                  />
                </div>

                <!-- Exercises attached to this Lesson -->
                <div
                  v-if="l.exercises?.length"
                  class="ms-10 flex flex-wrap gap-2"
                >
                  <div
                    v-for="ex in l.exercises"
                    :key="ex.id"
                    class="inline-flex items-center gap-1.5 rounded-lg ring ring-default bg-elevated/50 px-2.5 py-1 text-xs"
                  >
                    <button
                      type="button"
                      class="flex items-center gap-1.5 font-medium text-highlighted hover:text-primary cursor-pointer"
                      @click="activeExerciseId = ex.id; activeExerciseTitle = ex.title"
                    >
                      <UIcon
                        name="i-lucide-list-checks"
                        class="size-3.5 text-primary"
                      />
                      <span>{{ ex.title }}</span>
                      <UBadge
                        :label="`${ex.questionCount} Q`"
                        color="neutral"
                        variant="subtle"
                        size="xs"
                      />
                      <UBadge
                        v-if="ex.requiredForCompletion"
                        label="Req"
                        color="warning"
                        variant="soft"
                        size="xs"
                      />
                    </button>
                    <button
                      type="button"
                      class="text-muted hover:text-error ms-1 cursor-pointer"
                      aria-label="Delete exercise"
                      @click="deleteExercise(ex.id, ex.title)"
                    >
                      <UIcon
                        name="i-lucide-x"
                        class="size-3.5"
                      />
                    </button>
                  </div>
                </div>
              </li>
            </ol>
            <div
              v-else
              class="px-4 py-5 text-xs text-muted flex items-center justify-between"
            >
              <span>No lessons in this unit yet.</span>
              <UButton
                label="Add First Lesson"
                icon="i-lucide-plus"
                size="xs"
                variant="ghost"
                @click="openNewLesson(mod.id)"
              />
            </div>
          </UCard>

          <!-- Ungrouped Lessons (Backwards-compatible with flat courses) -->
          <UCard
            v-if="ungroupedLessons.length"
            :ui="{ body: 'p-0' }"
          >
            <div class="px-4 py-3 bg-elevated/40 border-b border-default flex items-center justify-between">
              <p class="font-semibold text-sm text-highlighted">
                Ungrouped Lessons
              </p>
              <span class="text-xs text-muted">Edit a lesson to move it into a unit</span>
            </div>
            <ol class="divide-y divide-default">
              <li
                v-for="(l, lIdx) in ungroupedLessons"
                :key="l.id"
                class="px-4 py-3 flex flex-col gap-2"
              >
                <div class="flex items-center gap-3">
                  <span class="size-7 shrink-0 rounded-full bg-elevated grid place-items-center text-xs font-semibold">{{ lIdx + 1 }}</span>
                  <button
                    type="button"
                    class="flex-1 min-w-0 text-start cursor-pointer"
                    @click="editingLesson = l"
                  >
                    <span class="block font-medium text-highlighted truncate">{{ l.title }}</span>
                  </button>
                  <UButton
                    label="Add Exercise"
                    icon="i-lucide-sparkles"
                    size="xs"
                    color="primary"
                    variant="subtle"
                    @click="openNewExercise(l)"
                  />
                  <UButton
                    icon="i-lucide-pencil"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    @click="editingLesson = l"
                  />
                  <UButton
                    icon="i-lucide-trash-2"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    @click="removeLesson(l)"
                  />
                </div>
                <div
                  v-if="l.exercises?.length"
                  class="ms-10 flex flex-wrap gap-2"
                >
                  <button
                    v-for="ex in l.exercises"
                    :key="ex.id"
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-lg ring ring-default bg-elevated/50 px-2.5 py-1 text-xs font-medium text-highlighted hover:text-primary cursor-pointer"
                    @click="activeExerciseId = ex.id; activeExerciseTitle = ex.title"
                  >
                    <UIcon
                      name="i-lucide-list-checks"
                      class="size-3.5 text-primary"
                    />
                    {{ ex.title }} ({{ ex.questionCount }} Q)
                  </button>
                </div>
              </li>
            </ol>
          </UCard>

          <UEmpty
            v-if="!c.modules.length && !c.lessons.length"
            icon="i-lucide-layers"
            title="Start building your curriculum"
            description="Add your first Unit/Module, then fill it with Lessons and 12-type interactive Exercises."
            :actions="[{ label: 'Add Unit / Module', icon: 'i-lucide-folder-plus', onClick: openNewModule }]"
          />
        </div>
      </template>

      <!-- DETAILS & CONTENT DRIP -->
      <UCard v-else-if="tab === 'drip'">
        <form
          class="grid gap-5"
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
          <div class="grid sm:grid-cols-3 gap-3">
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
            <UFormField label="Default Passing Score (%)">
              <UInputNumber
                v-model="details.passingScore"
                :min="0"
                :max="100"
                class="w-full"
              />
            </UFormField>
          </div>

          <!-- Content Drip Settings -->
          <div class="rounded-xl ring ring-default p-4 flex flex-col gap-4 bg-elevated/30">
            <div>
              <h3 class="text-sm font-bold text-highlighted flex items-center gap-2">
                <UIcon
                  name="i-lucide-calendar-clock"
                  class="size-4 text-primary"
                />
                Content Drip Schedule
              </h3>
              <p class="text-xs text-muted mt-0.5">
                Control how and when units and lessons unlock for enrolled students. You can also override dates on any individual Unit or Lesson.
              </p>
            </div>
            <URadioGroup
              v-model="details.dripMode"
              :items="dripOptions"
              variant="card"
            />
            <div
              v-if="details.dripMode === 'DATE_RANGE'"
              class="grid sm:grid-cols-2 gap-3"
            >
              <UFormField label="Course Available From">
                <UInput
                  v-model="details.dripStartAt"
                  type="datetime-local"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Course Available To (optional)">
                <UInput
                  v-model="details.dripEndAt"
                  type="datetime-local"
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>

          <UFormField label="Visibility">
            <URadioGroup
              v-model="details.visibility"
              :items="visibilityItems"
              variant="card"
            />
          </UFormField>

          <div class="flex items-center justify-between pt-2 border-t border-default">
            <UButton
              :label="t('courses.delete')"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              @click="removeCourse"
            />
            <UButton
              type="submit"
              :label="t('common.save')"
              :loading="savingDetails"
            />
          </div>
        </form>
      </UCard>

      <!-- LEARNERS ANALYTICS -->
      <UCard
        v-else
        :ui="{ body: 'p-0' }"
      >
        <div
          v-if="c.learners.length"
          class="overflow-x-auto"
        >
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-default text-left text-xs font-semibold text-muted">
                <th class="px-4 py-3">
                  Learner
                </th>
                <th class="px-4 py-3">
                  Lessons Progress
                </th>
                <th class="px-4 py-3">
                  Exercises Passed
                </th>
                <th class="px-4 py-3">
                  Avg. Exercise Score
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default/60">
              <tr
                v-for="u in c.learners"
                :key="u.id"
              >
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2.5">
                    <UAvatar
                      :src="u.avatarUrl ?? undefined"
                      :alt="u.name"
                      size="xs"
                    />
                    <span class="font-medium text-highlighted">{{ u.name }}</span>
                  </div>
                </td>
                <td class="px-4 py-3 w-52">
                  <div class="flex items-center gap-2">
                    <UProgress
                      :model-value="c.lessons.length ? Math.round((u.done / c.lessons.length) * 100) : 0"
                      size="xs"
                      class="flex-1"
                    />
                    <span class="text-xs text-muted tabular-nums">{{ u.done }}/{{ c.lessons.length }}</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-xs tabular-nums">
                  {{ u.exercisesPassed }} / {{ c.exerciseTotal }}
                </td>
                <td class="px-4 py-3">
                  <UBadge
                    v-if="u.avgExerciseScore != null"
                    :label="`${u.avgExerciseScore}%`"
                    :color="u.avgExerciseScore >= (c.passingScore ?? 70) ? 'success' : 'warning'"
                    variant="subtle"
                    size="xs"
                  />
                  <span
                    v-else
                    class="text-xs text-dimmed"
                  >—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <UEmpty
          v-else
          icon="i-lucide-users"
          :title="t('courses.noLearners')"
          :description="c.visibility === 'PUBLIC' ? t('courses.noLearnersPublic') : t('courses.noLearnersPrivate')"
          variant="naked"
        />
      </UCard>
    </div>

    <!-- Unit/Module Editor Modal -->
    <UModal
      v-model:open="moduleModalOpen"
      :title="editingModule ? 'Edit Unit / Module' : 'New Unit / Module'"
    >
      <template #body>
        <form
          class="grid gap-4"
          @submit.prevent="saveModule"
        >
          <UFormField label="Unit / Module Title">
            <UInput
              v-model="modForm.title"
              placeholder="e.g. Unit 2: Complex Sentences & Clauses"
              class="w-full"
              autofocus
            />
          </UFormField>
          <UFormField label="Description (optional)">
            <UTextarea
              v-model="modForm.description"
              :rows="2"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Unit Content Drip Override">
            <USelect
              v-model="modForm.dripMode"
              :items="[
                { label: 'Inherit from Course', value: 'INHERIT' },
                ...DRIP_MODES.map(m => ({ label: DRIP_MODE_META[m].label, value: m }))
              ]"
              class="w-full"
            />
          </UFormField>
          <div class="grid sm:grid-cols-2 gap-3">
            <UFormField label="Available From (optional)">
              <UInput
                v-model="modForm.availableFrom"
                type="datetime-local"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Available To (optional)">
              <UInput
                v-model="modForm.availableTo"
                type="datetime-local"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="ghost"
              @click="moduleModalOpen = false"
            />
            <UButton
              type="submit"
              :label="editingModule ? 'Save Unit' : 'Add Unit'"
              :loading="savingModule"
              :disabled="!modForm.title.trim()"
            />
          </div>
        </form>
      </template>
    </UModal>

    <!-- Lesson Editor Modal -->
    <UModal
      v-model:open="lessonModalOpen"
      :title="editingLesson === 'new' ? t('courses.addLesson') : (editingLesson as EditableLesson)?.title"
      :ui="{ content: 'sm:max-w-3xl' }"
    >
      <template #body>
        <CourseLessonEditor
          v-if="editingLesson !== null"
          :key="editingLesson === 'new' ? `new-${targetModuleId}` : editingLesson.id"
          :course-id="id"
          :lesson="editingLesson === 'new' ? null : editingLesson"
          :modules="c.modules"
          :default-module-id="targetModuleId"
          @saved="onLessonSaved"
          @close="editingLesson = null"
        />
      </template>
    </UModal>

    <!-- Quick Create Exercise Modal -->
    <UModal
      :open="!!creatingExerciseLesson"
      title="New Interactive Exercise"
      @update:open="v => { if (!v) creatingExerciseLesson = null }"
    >
      <template #body>
        <form
          class="grid gap-4"
          @submit.prevent="createExercise"
        >
          <UFormField label="Exercise Title">
            <UInput
              v-model="newExerciseTitle"
              placeholder="e.g. Grammar Drill: Present Perfect"
              class="w-full"
              autofocus
            />
          </UFormField>
          <UFormField label="Category">
            <USelect
              v-model="newExerciseType"
              :items="[{ label: 'Practice', value: 'PRACTICE' }, { label: 'Quiz', value: 'QUIZ' }, { label: 'Homework', value: 'HOMEWORK' }]"
              class="w-full"
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="ghost"
              @click="creatingExerciseLesson = null"
            />
            <UButton
              type="submit"
              label="Create & Add Questions"
              :loading="savingExercise"
              :disabled="!newExerciseTitle.trim()"
            />
          </div>
        </form>
      </template>
    </UModal>

    <!-- Exercise Builder Studio Modal (Questions + Settings + Live Preview) -->
    <UModal
      v-model:open="exerciseStudioOpen"
      :title="`Exercise Builder · ${activeExerciseTitle}`"
      :ui="{ content: 'sm:max-w-4xl' }"
    >
      <template #body>
        <LmsExerciseEditor
          v-if="activeExerciseId"
          :key="activeExerciseId"
          :exercise-id="activeExerciseId"
          @updated="refresh"
          @close="activeExerciseId = null"
        />
      </template>
    </UModal>
  </AppPage>
</template>
