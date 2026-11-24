<script setup lang="ts">
import type { CourseCard } from '~/components/course/Card.vue'
import type { EditableLesson } from '~/components/course/LessonEditor.vue'
import type { Topic } from '~/components/course/builder/Curriculum.vue'

/**
 * The course builder, in four steps a teacher moves between freely:
 * - Course info: what the course's page says (title, summary, description, cover, intro video,
 *   what learners will learn, need and are; exam, level, and who sees it);
 * - Curriculum: topics, their lessons and each lesson's quizzes, dragged into order; a lesson is
 *   written in a side panel, a quiz in the quiz builder;
 * - Settings: when lessons open, the pass mark, deleting the course;
 * - Learners: who takes it and how far each has got.
 * Publishing (with a lesson at least) and a preview of the course's page sit at the top.
 */
interface Learner { id: string, name: string, avatarUrl: string | null, done: number, tasksDone: number, exercisesPassed: number, avgExerciseScore: number | null }
interface ManageCourse extends Omit<CourseCard, 'lessons' | 'learners'> {
  coverUrl: string | null
  description: string | null
  introVideoUrl: string | null
  outcomes: string[]
  requirements: string[]
  audience: string[]
  dripMode: DripMode
  dripStartAt: string | null
  dripEndAt: string | null
  passingScore: number
  modules: Topic[]
  lessons: EditableLesson[]
  tasks: number
  exerciseTotal: number
  learners: Learner[]
}
type Tab = 'info' | 'curriculum' | 'settings' | 'learners'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const id = String(route.params.id)
const { isAdmin } = useMe()
const backPath = computed(() => (isAdmin.value ? '/admin/courses' : '/teacher/courses'))

const { data: c, error, refresh } = await useFetch<ManageCourse>(`/api/courses/${id}/manage`)
if (error.value || !c.value) throw createError({ statusCode: 404, statusMessage: t('courses.notFound'), fatal: true })
useSeoMeta({ title: () => c.value?.title ?? t('nav.courses'), robots: 'noindex' })

// ---- the steps, kept in the address (?tab=) so a reload or a link comes back to the same one ----
const TABS: Tab[] = ['info', 'curriculum', 'settings', 'learners']
const tab = computed<Tab>({
  get: () => (TABS.includes(route.query.tab as Tab) ? route.query.tab as Tab : c.value?.lessons.length ? 'curriculum' : 'info'),
  set: v => router.replace({ query: { ...route.query, tab: v } })
})
const tabs = computed(() => [
  { label: t('builder.tabInfo'), value: 'info', icon: 'i-lucide-file-pen' },
  { label: t('builder.tabCurriculum'), value: 'curriculum', icon: 'i-lucide-list-tree', badge: c.value?.lessons.length || undefined },
  { label: t('builder.tabSettings'), value: 'settings', icon: 'i-lucide-sliders-horizontal' },
  { label: t('builder.tabLearners'), value: 'learners', icon: 'i-lucide-users', badge: c.value?.learners.length || undefined }
])

// ---- publishing ----
const publishing = ref(false)
async function togglePublished() {
  if (!c.value) return
  if (!c.value.published && !c.value.lessons.length) {
    toast.add({ title: t('courses.addLessonFirst'), color: 'warning' })
    tab.value = 'curriculum'
    return
  }
  publishing.value = true
  try {
    await $fetch(`/api/courses/${id}`, { method: 'PATCH', body: { published: !c.value.published } })
    await refresh()
    toast.add({ title: c.value?.published ? t('builder.publishedToast') : t('builder.unpublishedToast'), color: 'success' })
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    publishing.value = false
  }
}
const statusText = computed(() => (!c.value?.published ? t('courses.draftText') : c.value.visibility === 'PUBLIC' ? t('courses.livepublic') : t('courses.liveprivate')))

// ---- a lesson, written in a side panel ----
const editing = ref<EditableLesson | 'new' | null>(null)
const newIn = ref<string | null>(null)
const panelOpen = computed({ get: () => editing.value !== null, set: (v: boolean) => { if (!v) editing.value = null } })
function addLesson(topicId: string | null) {
  newIn.value = topicId
  editing.value = 'new'
}
async function onLessonSaved(lessonId: string) {
  await refresh()
  const now = c.value?.lessons.find(x => x.id === lessonId) ?? null
  // A new lesson stays open (for its live class and quizzes); an edited one closes, unless its live class changed.
  editing.value = editing.value === 'new' ? now : (now && editing.value && now.live?.id !== (editing.value as EditableLesson).live?.id ? now : null)
}
onMounted(() => {
  const l = route.query.lesson
  const found = typeof l === 'string' ? c.value?.lessons.find(x => x.id === l) : null
  if (found) editing.value = found
})

// ---- a topic's details (title, description, when it opens) ----
const topicOpen = ref(false)
const topic = ref<Topic | null>(null)
const topicForm = reactive({ title: '', description: '', dripMode: 'INHERIT', availableFrom: '', availableTo: '' })
const toLocalInput = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
function editTopic(m: Topic) {
  topic.value = m
  Object.assign(topicForm, { title: m.title, description: m.description ?? '', dripMode: m.dripMode ?? 'INHERIT', availableFrom: toLocalInput(m.availableFrom), availableTo: toLocalInput(m.availableTo) })
  topicOpen.value = true
}
const topicDripItems = computed(() => [{ label: t('builder.drip.INHERIT'), value: 'INHERIT' }, ...DRIP_MODES.map(m => ({ label: t(`builder.drip.${m}`), value: m }))])
const savingTopic = ref(false)
async function saveTopic() {
  if (!topic.value || !topicForm.title.trim()) return
  savingTopic.value = true
  try {
    await $fetch(`/api/course-modules/${topic.value.id}`, {
      method: 'PATCH',
      body: {
        title: topicForm.title,
        description: topicForm.description.trim() || null,
        dripMode: topicForm.dripMode === 'INHERIT' ? null : topicForm.dripMode,
        availableFrom: topicForm.availableFrom ? new Date(topicForm.availableFrom).toISOString() : null,
        availableTo: topicForm.availableTo ? new Date(topicForm.availableTo).toISOString() : null
      }
    })
    topicOpen.value = false
    await refresh()
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    savingTopic.value = false
  }
}

// ---- quizzes: made on a lesson, then built in the quiz builder ----
const quizFor = ref<EditableLesson | null>(null)
const quizForm = reactive({ title: '', exerciseType: 'QUIZ' as ExerciseType })
const creatingQuiz = ref(false)
function addQuiz(l: EditableLesson) {
  quizFor.value = l
  Object.assign(quizForm, { title: '', exerciseType: 'QUIZ' })
}
const quizTypes = computed(() => EXERCISE_TYPES.map(x => ({ label: t(`builder.exType.${x}`), description: t(`builder.exType.${x}Text`), value: x })))
const studio = ref<{ id: string, title: string } | null>(null)
const studioOpen = computed({ get: () => !!studio.value, set: (v: boolean) => { if (!v) studio.value = null } })
async function createQuiz() {
  if (!quizFor.value || !quizForm.title.trim()) return
  creatingQuiz.value = true
  try {
    const made = await $fetch<{ id: string, title: string }>(`/api/course-lessons/${quizFor.value.id}/exercises`, {
      method: 'POST',
      body: { title: quizForm.title, exerciseType: quizForm.exerciseType, passingScore: c.value?.passingScore ?? 70 }
    })
    quizFor.value = null
    await refresh()
    studio.value = made
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    creatingQuiz.value = false
  }
}
</script>

<template>
  <AppPage
    v-if="c"
    :title="c.title"
    icon="i-lucide-pencil-ruler"
    :back="backPath"
  >
    <template #actions>
      <UBadge
        :label="c.published ? t('builder.published') : t('courses.draft')"
        :color="c.published ? 'success' : 'neutral'"
        variant="subtle"
        class="hidden sm:inline-flex"
      />
      <UButton
        :to="`/courses/${c.slug}`"
        target="_blank"
        :label="t('builder.preview')"
        icon="i-lucide-eye"
        color="neutral"
        variant="ghost"
      />
      <UButton
        :label="c.published ? t('courses.unpublish') : t('courses.publish')"
        :icon="c.published ? 'i-lucide-eye-off' : 'i-lucide-rocket'"
        :color="c.published ? 'neutral' : 'primary'"
        :variant="c.published ? 'outline' : 'solid'"
        :loading="publishing"
        data-testid="publish"
        @click="togglePublished"
      />
    </template>

    <div class="flex flex-col gap-5 w-full max-w-6xl">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <UTabs
          v-model="tab"
          :items="tabs"
          :content="false"
          variant="link"
          class="w-full sm:w-auto overflow-x-auto"
          data-testid="builder-tabs"
        />
        <p class="text-sm text-muted flex items-center gap-1.5">
          <UIcon
            :name="c.published ? (c.visibility === 'PUBLIC' ? 'i-lucide-globe' : 'i-lucide-lock') : 'i-lucide-file-pen'"
            class="size-4 shrink-0"
          />{{ statusText }}
        </p>
      </div>

      <CourseBuilderInfo
        v-if="tab === 'info'"
        :course="c"
        @saved="refresh"
      />
      <CourseBuilderCurriculum
        v-else-if="tab === 'curriculum'"
        :course-id="id"
        :topics="c.modules"
        :lessons="c.lessons"
        @changed="refresh"
        @add-lesson="addLesson"
        @edit-lesson="l => (editing = l)"
        @edit-topic="editTopic"
        @add-exercise="addQuiz"
        @open-exercise="x => (studio = { id: x.id, title: x.title })"
      />
      <CourseBuilderSettings
        v-else-if="tab === 'settings'"
        :key="`${c.dripMode}-${c.passingScore}`"
        :course="c"
        @saved="refresh"
        @deleted="router.push(backPath)"
      />
      <CourseBuilderLearners
        v-else
        :learners="c.learners"
        :lessons="c.lessons.length"
        :quizzes="c.exerciseTotal"
        :passing-score="c.passingScore"
        :visibility="c.visibility"
      />
    </div>

    <!-- A lesson, written beside the curriculum -->
    <USlideover
      v-model:open="panelOpen"
      :title="editing === 'new' ? t('courses.addLesson') : t('courses.editLesson')"
      :ui="{ content: 'sm:max-w-3xl w-full', body: 'p-4 sm:p-6' }"
    >
      <template #body>
        <CourseLessonEditor
          v-if="editing !== null"
          :key="editing === 'new' ? `new-${newIn}` : editing.id"
          :course-id="id"
          :lesson="editing === 'new' ? null : editing"
          :modules="c.modules"
          :default-module-id="newIn"
          @saved="onLessonSaved"
          @close="editing = null"
        />
      </template>
    </USlideover>

    <!-- A topic's details -->
    <UModal
      v-model:open="topicOpen"
      :title="t('builder.editTopic')"
    >
      <template #body>
        <form
          class="grid gap-4"
          @submit.prevent="saveTopic"
        >
          <UFormField :label="t('builder.topicTitle')">
            <UInput
              v-model="topicForm.title"
              class="w-full"
              :maxlength="200"
              autofocus
            />
          </UFormField>
          <UFormField :label="t('builder.topicDescription')">
            <UTextarea
              v-model="topicForm.description"
              :rows="2"
              autoresize
              class="w-full"
            />
          </UFormField>
          <UFormField
            :label="t('builder.topicRelease')"
            :help="t('builder.topicReleaseHelp')"
          >
            <USelect
              v-model="topicForm.dripMode"
              :items="topicDripItems"
              class="w-full"
            />
          </UFormField>
          <div class="grid sm:grid-cols-2 gap-3">
            <UFormField :label="t('builder.availableFrom')">
              <UInput
                v-model="topicForm.availableFrom"
                type="datetime-local"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('builder.availableTo')">
              <UInput
                v-model="topicForm.availableTo"
                type="datetime-local"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="flex justify-end gap-2">
            <UButton
              :label="t('common.cancel')"
              color="neutral"
              variant="ghost"
              @click="topicOpen = false"
            />
            <UButton
              type="submit"
              :label="t('common.save')"
              :loading="savingTopic"
              :disabled="!topicForm.title.trim()"
            />
          </div>
        </form>
      </template>
    </UModal>

    <!-- A new quiz on a lesson -->
    <UModal
      :open="!!quizFor"
      :title="t('builder.newQuiz')"
      :description="quizFor ? t('builder.newQuizIn', { lesson: quizFor.title }) : undefined"
      @update:open="v => { if (!v) quizFor = null }"
    >
      <template #body>
        <form
          class="grid gap-4"
          @submit.prevent="createQuiz"
        >
          <UFormField :label="t('builder.quizTitle')">
            <UInput
              v-model="quizForm.title"
              :placeholder="t('builder.quizTitlePlaceholder')"
              class="w-full"
              autofocus
              data-testid="quiz-title"
            />
          </UFormField>
          <UFormField :label="t('builder.quizKind')">
            <URadioGroup
              v-model="quizForm.exerciseType"
              :items="quizTypes"
              variant="card"
              size="sm"
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton
              :label="t('common.cancel')"
              color="neutral"
              variant="ghost"
              @click="quizFor = null"
            />
            <UButton
              type="submit"
              :label="t('builder.createQuiz')"
              :loading="creatingQuiz"
              :disabled="!quizForm.title.trim()"
            />
          </div>
        </form>
      </template>
    </UModal>

    <!-- The quiz builder: questions (12 kinds), settings and a preview -->
    <UModal
      v-model:open="studioOpen"
      :title="studio?.title"
      fullscreen
    >
      <template #body>
        <div class="max-w-4xl mx-auto w-full">
          <LmsExerciseEditor
            v-if="studio"
            :key="studio.id"
            :exercise-id="studio.id"
            @updated="refresh"
            @close="studio = null"
          />
        </div>
      </template>
    </UModal>
  </AppPage>
</template>
