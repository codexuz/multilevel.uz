<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { EditableLesson } from '~/components/course/LessonEditor.vue'

/**
 * The course builder's curriculum: topics (units) in order, each with its lessons, and each lesson
 * with its quizzes and exercises. Topics fold; lessons are dragged within a topic or into another,
 * and topics are dragged into order (or moved with each row's menu, by keyboard or on a phone).
 * Editing a lesson, a topic or a quiz is the page's: this asks for it with an event.
 */
export interface Topic {
  id: string
  position: number
  title: string
  description: string | null
  dripMode: string | null
  availableFrom: string | null
  availableTo: string | null
}
type Exercise = NonNullable<EditableLesson['exercises']>[number]

const props = defineProps<{ courseId: string, topics: Topic[], lessons: EditableLesson[] }>()
const emit = defineEmits<{
  'changed': []
  'add-lesson': [topicId: string | null]
  'edit-lesson': [lesson: EditableLesson]
  'edit-topic': [topic: Topic]
  'add-exercise': [lesson: EditableLesson]
  'open-exercise': [exercise: Exercise]
}>()
const { t } = useI18n()
const toast = useToast()
const { confirm } = useDialogs()

// ---- the layout: topics in order, each with its lessons' ids (null: lessons outside a topic) ----
interface Group { id: string | null, lessons: string[] }
const layoutOf = (): Group[] => {
  const groups: Group[] = props.topics.map(m => ({ id: m.id, lessons: props.lessons.filter(l => l.moduleId === m.id).map(l => l.id) }))
  const known = new Set(props.topics.map(m => m.id))
  const loose = props.lessons.filter(l => !l.moduleId || !known.has(l.moduleId)).map(l => l.id)
  if (loose.length) groups.push({ id: null, lessons: loose })
  return groups
}
const layout = ref<Group[]>(layoutOf())
watch(() => [props.topics, props.lessons], () => (layout.value = layoutOf()))

const lessonById = computed(() => new Map(props.lessons.map(l => [l.id, l])))
const topicById = computed(() => new Map(props.topics.map(m => [m.id, m])))
const minutesOf = (ids: string[]) => ids.reduce((n, id) => n + (lessonById.value.get(id)?.durationMinutes ?? 0), 0)
const totals = computed(() => ({
  topics: props.topics.length,
  lessons: props.lessons.length,
  quizzes: props.lessons.reduce((n, l) => n + (l.exercises?.length ?? 0), 0),
  minutes: minutesOf(props.lessons.map(l => l.id))
}))
const duration = (min: number) => (min >= 60 ? t('builder.hoursMinutes', { h: Math.floor(min / 60), m: min % 60 }) : t('builder.minutes', { n: min }))

// ---- folding ----
const folded = ref(new Set<string>())
const keyOf = (g: Group) => g.id ?? '__loose__'
const toggle = (g: Group) => {
  const next = new Set(folded.value)
  if (next.has(keyOf(g))) next.delete(keyOf(g))
  else next.add(keyOf(g))
  folded.value = next
}
const allFolded = computed(() => layout.value.length > 0 && layout.value.every(g => folded.value.has(keyOf(g))))
const foldAll = () => (folded.value = allFolded.value ? new Set() : new Set(layout.value.map(keyOf)))

// ---- saving a new arrangement (optimistic; put back if the server refuses) ----
const saving = ref(false)
async function commit(next: Group[]) {
  const before = layout.value
  layout.value = next
  saving.value = true
  try {
    await $fetch(`/api/courses/${props.courseId}/curriculum`, {
      method: 'POST',
      body: {
        modules: next.filter(g => g.id).map(g => g.id),
        lessons: next.flatMap(g => g.lessons.map(id => ({ id, moduleId: g.id })))
      }
    })
    emit('changed')
  } catch (e) {
    layout.value = before
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}
const clone = () => layout.value.map(g => ({ id: g.id, lessons: [...g.lessons] }))

function moveLesson(id: string, toGroup: string | null, toIndex: number) {
  const next = clone()
  const from = next.find(g => g.lessons.includes(id))
  const to = next.find(g => g.id === toGroup)
  if (!from || !to) return
  const fromIndex = from.lessons.indexOf(id)
  from.lessons.splice(fromIndex, 1)
  const at = from === to && fromIndex < toIndex ? toIndex - 1 : toIndex
  to.lessons.splice(Math.max(0, Math.min(at, to.lessons.length)), 0, id)
  if (JSON.stringify(next) !== JSON.stringify(layout.value)) commit(next)
}
function moveTopic(id: string, toIndex: number) {
  const next = clone()
  const topics = next.filter(g => g.id)
  const loose = next.filter(g => !g.id)
  const i = topics.findIndex(g => g.id === id)
  if (i < 0) return
  const [g] = topics.splice(i, 1)
  topics.splice(Math.max(0, Math.min(toIndex > i ? toIndex - 1 : toIndex, topics.length)), 0, g!)
  const result = [...topics, ...loose]
  if (JSON.stringify(result) !== JSON.stringify(layout.value)) commit(result)
}

// ---- drag and drop ----
type Drag = { kind: 'lesson', id: string } | { kind: 'topic', id: string } | { kind: 'quiz', id: string, lesson: string }
const drag = ref<Drag | null>(null)
const drop = ref<{ group: string | null, index: number } | null>(null)
const topicDrop = ref<number | null>(null)
/** Where a dragged quiz would land: a lesson, and its place among that lesson's quizzes. */
const quizDrop = ref<{ lesson: string, index: number } | null>(null)

function startLesson(e: DragEvent, id: string) {
  drag.value = { kind: 'lesson', id }
  e.dataTransfer?.setData('text/plain', id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function startQuiz(e: DragEvent, id: string, lesson: string) {
  drag.value = { kind: 'quiz', id, lesson }
  e.dataTransfer?.setData('text/plain', id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
/** Over a quiz: before or after it. */
function overQuiz(e: DragEvent, lesson: string, index: number) {
  if (drag.value?.kind !== 'quiz') return
  e.preventDefault()
  e.stopPropagation()
  const el = e.currentTarget as HTMLElement
  quizDrop.value = { lesson, index: index + (e.clientY > el.getBoundingClientRect().top + el.offsetHeight / 2 ? 1 : 0) }
}
/** Over a lesson: after its quizzes. */
function overLessonForQuiz(e: DragEvent, lesson: string) {
  if (drag.value?.kind !== 'quiz') return
  e.preventDefault()
  quizDrop.value = { lesson, index: lessonById.value.get(lesson)?.exercises?.length ?? 0 }
}
const isQuizDropAt = (lesson: string, index: number) => drag.value?.kind === 'quiz' && quizDrop.value?.lesson === lesson && quizDrop.value.index === index
const isQuizDropInto = (lesson: string) => drag.value?.kind === 'quiz' && quizDrop.value?.lesson === lesson && quizDrop.value.index === (lessonById.value.get(lesson)?.exercises?.length ?? 0) && drag.value.lesson !== lesson

/**
 * Moves a quiz to place `index` of a lesson's quizzes (in the order shown, counting the quiz itself
 * when it stays in its lesson). Any lesson of the course, in any topic.
 */
async function moveQuiz(id: string, toLesson: string, index: number) {
  const from = props.lessons.find(l => l.exercises?.some(x => x.id === id))
  if (!from) return
  const fromIndex = from.exercises!.findIndex(x => x.id === id)
  const at = from.id === toLesson && fromIndex < index ? index - 1 : index
  if (from.id === toLesson && at === fromIndex) return
  saving.value = true
  try {
    await $fetch(`/api/course-exercises/${id}/move`, { method: 'POST', body: { lessonId: toLesson, index: at } })
    if (from.id !== toLesson) toast.add({ title: t('builder.quizMoved', { lesson: lessonById.value.get(toLesson)?.title ?? '' }), color: 'success', icon: 'i-lucide-check' })
    emit('changed')
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}
function startTopic(e: DragEvent, id: string) {
  drag.value = { kind: 'topic', id }
  e.dataTransfer?.setData('text/plain', id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function overLesson(e: DragEvent, g: Group, index: number) {
  if (drag.value?.kind !== 'lesson') return
  e.preventDefault()
  const el = e.currentTarget as HTMLElement
  const below = e.clientY > el.getBoundingClientRect().top + el.offsetHeight / 2
  drop.value = { group: g.id, index: index + (below ? 1 : 0) }
}
function overGroupEnd(e: DragEvent, g: Group) {
  if (drag.value?.kind !== 'lesson') return
  e.preventDefault()
  drop.value = { group: g.id, index: g.lessons.length }
}
function overTopic(e: DragEvent, index: number) {
  if (drag.value?.kind !== 'topic') return
  e.preventDefault()
  const el = e.currentTarget as HTMLElement
  topicDrop.value = index + (e.clientY > el.getBoundingClientRect().top + el.offsetHeight / 2 ? 1 : 0)
}
function finish() {
  const d = drag.value
  if (d?.kind === 'lesson' && drop.value) moveLesson(d.id, drop.value.group, drop.value.index)
  if (d?.kind === 'topic' && topicDrop.value !== null) moveTopic(d.id, topicDrop.value)
  if (d?.kind === 'quiz' && quizDrop.value) moveQuiz(d.id, quizDrop.value.lesson, quizDrop.value.index)
  drag.value = null
  drop.value = null
  topicDrop.value = null
  quizDrop.value = null
}
/** A drag let go anywhere but on the curriculum changes nothing. */
function cancel() {
  drag.value = null
  drop.value = null
  topicDrop.value = null
  quizDrop.value = null
}
const isDropAt = (g: Group, index: number) => drag.value?.kind === 'lesson' && drop.value?.group === g.id && drop.value.index === index

// ---- topics: add inline, delete ----
const adding = ref(false)
const newTopic = ref('')
const addingBusy = ref(false)
async function addTopic() {
  if (!newTopic.value.trim()) return
  addingBusy.value = true
  try {
    await $fetch(`/api/courses/${props.courseId}/modules`, { method: 'POST', body: { title: newTopic.value.trim() } })
    newTopic.value = ''
    adding.value = false
    emit('changed')
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    addingBusy.value = false
  }
}
async function deleteTopic(m: Topic) {
  if (!await confirm({ title: t('builder.deleteTopicSure', { title: m.title }), description: t('builder.deleteTopicText'), confirmLabel: t('builder.delete'), color: 'error' })) return
  await $fetch(`/api/course-modules/${m.id}`, { method: 'DELETE' }).catch(e => toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' }))
  emit('changed')
}
async function deleteLesson(l: EditableLesson) {
  if (!await confirm({ title: t('courses.deleteLessonSure', { title: l.title }), confirmLabel: t('builder.delete'), color: 'error' })) return
  await $fetch(`/api/course-lessons/${l.id}`, { method: 'DELETE' }).catch(e => toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' }))
  emit('changed')
}
async function deleteExercise(x: Exercise) {
  if (!await confirm({ title: t('builder.deleteQuizSure', { title: x.title }), confirmLabel: t('builder.delete'), color: 'error' })) return
  await $fetch(`/api/course-exercises/${x.id}`, { method: 'DELETE' }).catch(e => toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' }))
  emit('changed')
}

// ---- menus (the keyboard's and the phone's way to move things) ----
function topicMenu(g: Group, index: number): DropdownMenuItem[][] {
  const m = topicById.value.get(g.id!)!
  const count = layout.value.filter(x => x.id).length
  return [
    [
      { label: t('builder.editTopic'), icon: 'i-lucide-pencil', onSelect: () => emit('edit-topic', m) },
      { label: t('builder.moveUp'), icon: 'i-lucide-arrow-up', disabled: index === 0, onSelect: () => moveTopic(m.id, index - 1) },
      { label: t('builder.moveDown'), icon: 'i-lucide-arrow-down', disabled: index >= count - 1, onSelect: () => moveTopic(m.id, index + 2) }
    ],
    [{ label: t('builder.deleteTopic'), icon: 'i-lucide-trash-2', color: 'error', onSelect: () => deleteTopic(m) }]
  ]
}
function lessonMenu(g: Group, l: EditableLesson, index: number): DropdownMenuItem[][] {
  const others = layout.value.filter(x => x.id !== g.id)
  return [
    [
      { label: t('builder.editLesson'), icon: 'i-lucide-pencil', onSelect: () => emit('edit-lesson', l) },
      { label: t('builder.addQuiz'), icon: 'i-lucide-list-checks', onSelect: () => emit('add-exercise', l) },
      { label: t('builder.moveUp'), icon: 'i-lucide-arrow-up', disabled: index === 0, onSelect: () => moveLesson(l.id, g.id, index - 1) },
      { label: t('builder.moveDown'), icon: 'i-lucide-arrow-down', disabled: index === g.lessons.length - 1, onSelect: () => moveLesson(l.id, g.id, index + 2) },
      ...(others.length
        ? [{
            label: t('builder.moveTo'),
            icon: 'i-lucide-folder-input',
            children: others.map(o => ({ label: o.id ? topicById.value.get(o.id)?.title ?? '' : t('builder.outsideTopics'), onSelect: () => moveLesson(l.id, o.id, o.lessons.length) }))
          }]
        : [])
    ],
    [{ label: t('builder.deleteLesson'), icon: 'i-lucide-trash-2', color: 'error', onSelect: () => deleteLesson(l) }]
  ]
}

/** A quiz's menu: up, down, to another lesson (by topic), delete. */
function quizMenu(l: EditableLesson, x: Exercise, index: number): DropdownMenuItem[][] {
  const count = l.exercises?.length ?? 0
  const lessonsOf = (g: Group) => g.lessons.filter(id => id !== l.id).map(id => ({ label: lessonById.value.get(id)?.title ?? '', icon: 'i-lucide-file-text', onSelect: () => moveQuiz(x.id, id, lessonById.value.get(id)?.exercises?.length ?? 0) }))
  const groups = layout.value.map(g => ({ g, items: lessonsOf(g) })).filter(x => x.items.length)
  const targets = groups.length === 1
    ? groups[0]!.items
    : groups.map(({ g, items }) => ({ label: g.id ? topicById.value.get(g.id)?.title ?? '' : t('builder.outsideTopics'), icon: 'i-lucide-folder', children: items }))
  return [
    [
      { label: t('builder.editQuiz'), icon: 'i-lucide-pencil', onSelect: () => emit('open-exercise', x) },
      { label: t('builder.moveUp'), icon: 'i-lucide-arrow-up', disabled: index === 0, onSelect: () => moveQuiz(x.id, l.id, index - 1) },
      { label: t('builder.moveDown'), icon: 'i-lucide-arrow-down', disabled: index >= count - 1, onSelect: () => moveQuiz(x.id, l.id, index + 2) },
      ...(targets.length ? [{ label: t('builder.moveQuizTo'), icon: 'i-lucide-folder-input', children: targets }] : [])
    ],
    [{ label: t('builder.deleteQuiz'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => deleteExercise(x) }]
  ]
}

const contentIcons = (l: EditableLesson) => [
  l.body && { icon: 'i-lucide-file-text', label: t('courses.text') },
  l.videoUrl && { icon: 'i-lucide-play-circle', label: t('courses.video') },
  l.audioUrl && { icon: 'i-lucide-audio-lines', label: t('media.audio') },
  l.task && { icon: 'i-lucide-clipboard-check', label: t('courses.withTask') },
  l.files.length && { icon: 'i-lucide-paperclip', label: t('courses.files') },
  l.live?.status === 'SCHEDULED' && { icon: 'i-lucide-video', label: t('courses.liveTitle') }
].filter(Boolean) as { icon: string, label: string }[]
const lessonIcon = (l: EditableLesson) => (l.videoUrl ? 'i-lucide-circle-play' : l.audioUrl ? 'i-lucide-audio-lines' : l.live?.status === 'SCHEDULED' ? 'i-lucide-video' : 'i-lucide-file-text')
const topicNumber = (g: Group) => props.topics.findIndex(m => m.id === g.id) + 1
</script>

<template>
  <div
    class="flex flex-col gap-4"
    data-testid="curriculum"
  >
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p class="text-sm text-muted tabular-nums">
        {{ [t('builder.topicCount', { n: totals.topics }, totals.topics), t('courses.lessons', { n: totals.lessons }, totals.lessons), t('builder.quizCount', { n: totals.quizzes }, totals.quizzes)].join(' · ') }}<template v-if="totals.minutes">
          · {{ duration(totals.minutes) }}
        </template>
      </p>
      <UIcon
        v-if="saving"
        name="i-lucide-loader-circle"
        class="size-4 animate-spin text-dimmed"
      />
      <div class="ms-auto flex items-center gap-2">
        <UButton
          v-if="layout.length"
          :label="allFolded ? t('builder.expandAll') : t('builder.collapseAll')"
          :icon="allFolded ? 'i-lucide-chevrons-up-down' : 'i-lucide-chevrons-down-up'"
          size="sm"
          color="neutral"
          variant="ghost"
          @click="foldAll"
        />
      </div>
    </div>

    <UEmpty
      v-if="!layout.length && !adding"
      icon="i-lucide-layers"
      :title="t('builder.emptyTitle')"
      :description="t('builder.emptyText')"
      :actions="[{ label: t('builder.addTopic'), icon: 'i-lucide-plus', onClick: () => { adding = true } }, { label: t('courses.addLesson'), icon: 'i-lucide-file-plus', color: 'neutral', variant: 'outline', onClick: () => emit('add-lesson', null) }]"
      variant="outline"
    />

    <section
      v-for="(g, gi) in layout"
      :key="keyOf(g)"
      class="rounded-xl ring ring-default bg-default transition-shadow"
      :class="[
        drag?.kind === 'topic' && drag.id === g.id ? 'opacity-50' : '',
        drag?.kind === 'topic' && topicDrop === gi ? 'shadow-[0_-3px_0_0_var(--ui-primary)]' : '',
        drag?.kind === 'topic' && topicDrop === gi + 1 && gi === layout.length - 1 ? 'shadow-[0_3px_0_0_var(--ui-primary)]' : ''
      ]"
      :data-testid="g.id ? 'topic' : 'loose-lessons'"
      @dragover="g.id ? overTopic($event, gi) : undefined"
      @drop.prevent="finish"
    >
      <header
        class="flex items-center gap-2 px-3 sm:px-4 py-3"
        :class="folded.has(keyOf(g)) ? '' : 'border-b border-default'"
      >
        <span
          v-if="g.id"
          class="hidden sm:grid place-items-center size-7 rounded-md text-dimmed hover:text-toned hover:bg-elevated cursor-grab active:cursor-grabbing"
          draggable="true"
          :title="t('builder.dragTopic')"
          @dragstart="startTopic($event, g.id)"
          @dragend="cancel"
        >
          <UIcon
            name="i-lucide-grip-vertical"
            class="size-4"
          />
        </span>
        <button
          type="button"
          class="flex-1 min-w-0 flex items-center gap-2 text-start cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-primary"
          :aria-expanded="!folded.has(keyOf(g))"
          @click="toggle(g)"
        >
          <UIcon
            name="i-lucide-chevron-right"
            class="size-4 text-muted shrink-0 transition-transform duration-200"
            :class="folded.has(keyOf(g)) ? '' : 'rotate-90'"
          />
          <span class="min-w-0">
            <span class="block text-xs text-muted">
              {{ g.id ? t('builder.topicN', { n: topicNumber(g) }) : t('builder.outsideTopics') }}
              · {{ t('courses.lessons', { n: g.lessons.length }, g.lessons.length) }}<template v-if="minutesOf(g.lessons)"> · {{ duration(minutesOf(g.lessons)) }}</template>
            </span>
            <span class="block font-semibold text-highlighted truncate">
              {{ g.id ? topicById.get(g.id)?.title : t('builder.outsideTopicsTitle') }}
            </span>
          </span>
        </button>
        <UBadge
          v-if="g.id && (topicById.get(g.id)?.dripMode || topicById.get(g.id)?.availableFrom)"
          :label="t('builder.scheduled')"
          icon="i-lucide-calendar-clock"
          color="neutral"
          variant="subtle"
          class="hidden sm:inline-flex"
        />
        <UButton
          :label="t('builder.lesson')"
          icon="i-lucide-plus"
          size="sm"
          color="neutral"
          variant="ghost"
          class="hidden sm:inline-flex"
          @click="emit('add-lesson', g.id)"
        />
        <UDropdownMenu
          v-if="g.id"
          :items="topicMenu(g, gi)"
          :content="{ align: 'end' }"
        >
          <UButton
            icon="i-lucide-ellipsis"
            size="sm"
            color="neutral"
            variant="ghost"
            :aria-label="t('builder.topicActions')"
          />
        </UDropdownMenu>
      </header>

      <div
        v-show="!folded.has(keyOf(g))"
        class="p-2 sm:p-3"
      >
        <p
          v-if="g.id && topicById.get(g.id)?.description"
          class="px-2 pb-2 text-sm text-muted"
        >
          {{ topicById.get(g.id)?.description }}
        </p>
        <ol class="flex flex-col">
          <li
            v-for="(id, li) in g.lessons"
            :key="id"
            class="relative"
            @dragover="overLesson($event, g, li)"
          >
            <div
              v-if="isDropAt(g, li)"
              class="absolute inset-x-2 -top-px h-0.5 rounded-full bg-primary"
            />
            <div
              v-if="lessonById.get(id)"
              class="group flex items-center gap-2 rounded-lg px-1.5 sm:px-2 py-2 hover:bg-elevated/60"
              :class="[drag?.kind === 'lesson' && drag.id === id ? 'opacity-40' : '', isQuizDropInto(id) ? 'ring-2 ring-primary bg-primary/5' : '']"
              data-testid="builder-lesson"
              @dragover="overLessonForQuiz($event, id)"
            >
              <span
                class="hidden sm:grid place-items-center size-6 rounded text-dimmed opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
                draggable="true"
                :title="t('builder.dragLesson')"
                @dragstart="startLesson($event, id)"
                @dragend="cancel"
              >
                <UIcon
                  name="i-lucide-grip-vertical"
                  class="size-4"
                />
              </span>
              <span class="grid place-items-center size-8 rounded-lg bg-elevated text-toned shrink-0">
                <UIcon
                  :name="lessonIcon(lessonById.get(id)!)"
                  class="size-4"
                />
              </span>
              <button
                type="button"
                class="flex-1 min-w-0 text-start cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-primary"
                @click="emit('edit-lesson', lessonById.get(id)!)"
              >
                <span class="block font-medium text-highlighted truncate group-hover:text-primary">{{ lessonById.get(id)!.title }}</span>
                <span class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                  <UIcon
                    v-for="c in contentIcons(lessonById.get(id)!)"
                    :key="c.icon"
                    :name="c.icon"
                    :aria-label="c.label"
                    class="size-3.5"
                  />
                  <span v-if="lessonById.get(id)!.durationMinutes">{{ duration(lessonById.get(id)!.durationMinutes!) }}</span>
                  <span v-if="lessonById.get(id)!.availableFrom">{{ t('builder.opensOn', { date: localeDate(lessonById.get(id)!.availableFrom!, intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) }) }}</span>
                  <span v-if="!contentIcons(lessonById.get(id)!).length && !lessonById.get(id)!.exercises?.length">{{ t('builder.emptyLesson') }}</span>
                </span>
              </button>
              <UButton
                :label="t('builder.quiz')"
                icon="i-lucide-plus"
                size="xs"
                color="neutral"
                variant="ghost"
                class="hidden md:inline-flex opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                @click="emit('add-exercise', lessonById.get(id)!)"
              />
              <UDropdownMenu
                :items="lessonMenu(g, lessonById.get(id)!, li)"
                :content="{ align: 'end' }"
              >
                <UButton
                  icon="i-lucide-ellipsis"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  :aria-label="t('builder.lessonActions')"
                />
              </UDropdownMenu>
            </div>

            <ul
              v-if="lessonById.get(id)?.exercises?.length"
              class="ms-11 sm:ms-[4.25rem] mb-1 flex flex-col border-s border-default ps-2"
            >
              <li
                v-for="(x, xi) in lessonById.get(id)!.exercises"
                :key="x.id"
                class="group/x relative flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-elevated/60"
                :class="drag?.kind === 'quiz' && drag.id === x.id ? 'opacity-40' : ''"
                data-testid="builder-quiz"
                @dragover="overQuiz($event, id, xi)"
              >
                <div
                  v-if="isQuizDropAt(id, xi)"
                  class="absolute inset-x-1 -top-px h-0.5 rounded-full bg-primary"
                />
                <div
                  v-if="xi === lessonById.get(id)!.exercises!.length - 1 && isQuizDropAt(id, xi + 1)"
                  class="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-primary"
                />
                <span
                  class="hidden sm:grid place-items-center size-5 -ms-1 rounded text-dimmed opacity-0 group-hover/x:opacity-100 cursor-grab active:cursor-grabbing"
                  draggable="true"
                  :title="t('builder.dragQuiz')"
                  data-testid="quiz-grip"
                  @dragstart="startQuiz($event, x.id, id)"
                  @dragend="cancel"
                >
                  <UIcon
                    name="i-lucide-grip-vertical"
                    class="size-3.5"
                  />
                </span>
                <UIcon
                  name="i-lucide-list-checks"
                  class="size-4 text-primary shrink-0"
                />
                <button
                  type="button"
                  class="flex-1 min-w-0 text-start text-sm cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-primary"
                  @click="emit('open-exercise', x)"
                >
                  <span class="font-medium text-highlighted group-hover/x:text-primary">{{ x.title }}</span>
                  <span class="text-muted"> · {{ t(`builder.exType.${x.exerciseType}`) }} · {{ t('builder.questions', { n: x.questionCount }, x.questionCount) }}</span>
                </button>
                <UBadge
                  v-if="x.requiredForCompletion"
                  :label="t('builder.required')"
                  color="neutral"
                  variant="outline"
                  size="sm"
                />
                <UDropdownMenu
                  :items="quizMenu(lessonById.get(id)!, x, xi)"
                  :content="{ align: 'end' }"
                >
                  <UButton
                    icon="i-lucide-ellipsis"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    :aria-label="t('builder.quizActions')"
                    data-testid="quiz-menu"
                  />
                </UDropdownMenu>
              </li>
            </ul>
          </li>
        </ol>

        <div
          class="relative mt-1"
          @dragover="overGroupEnd($event, g)"
        >
          <div
            v-if="isDropAt(g, g.lessons.length) && g.lessons.length"
            class="absolute inset-x-2 -top-px h-0.5 rounded-full bg-primary"
          />
          <button
            type="button"
            class="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm transition-colors cursor-pointer"
            :class="isDropAt(g, g.lessons.length) && !g.lessons.length ? 'border-primary bg-primary/5 text-primary' : 'border-accented text-muted hover:text-highlighted hover:border-(--ui-text-dimmed)'"
            data-testid="topic-add-lesson"
            @click="emit('add-lesson', g.id)"
          >
            <UIcon
              name="i-lucide-plus"
              class="size-4"
            />
            {{ g.lessons.length ? t('courses.addLesson') : t('builder.firstLesson') }}
          </button>
        </div>
      </div>
    </section>

    <form
      v-if="adding"
      class="flex items-center gap-2 rounded-xl ring ring-primary/40 bg-default p-3"
      @submit.prevent="addTopic"
    >
      <UInput
        v-model="newTopic"
        :placeholder="t('builder.topicPlaceholder')"
        class="flex-1"
        :maxlength="200"
        autofocus
        data-testid="new-topic"
        @keydown.esc="adding = false"
      />
      <UButton
        :label="t('common.cancel')"
        color="neutral"
        variant="ghost"
        @click="adding = false"
      />
      <UButton
        type="submit"
        :label="t('builder.addTopic')"
        :loading="addingBusy"
        :disabled="!newTopic.trim()"
      />
    </form>
    <UButton
      v-else-if="layout.length"
      :label="t('builder.addTopic')"
      icon="i-lucide-plus"
      color="neutral"
      variant="outline"
      class="self-start"
      data-testid="add-topic"
      @click="adding = true"
    />
  </div>
</template>
