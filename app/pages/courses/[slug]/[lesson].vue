<script setup lang="ts">
import type { LiveLesson } from '~/components/online/Row.vue'
import type { DripState } from '#shared/utils/lms'

/**
 * Student LMS Lesson Player:
 * - Course Curriculum Outline sidebar (Units => Lessons with checkmarks & content-drip locks)
 * - Graceful Content Drip lock screen (shows unlock date or prerequisite lesson)
 * - Video, Google Meet, rich notes, PDFs, Exam Task, and interactive 12-type Lesson Exercises
 */
interface LessonExerciseSummary {
  id: string
  position: number
  title: string
  instructions: string | null
  exerciseType: string
  passingScore: number
  timeLimitSeconds: number | null
  maxAttempts: number | null
  requiredForCompletion: boolean
  questionCount: number
  attemptsUsed: number
  bestScore: number | null
  passed: boolean
}

interface LessonView {
  id: string
  moduleId: string | null
  module: { id: string, title: string, position: number } | null
  title: string
  summary: string | null
  durationMinutes: number | null
  body: string | null
  videoUrl: string | null
  files: { name: string, url: string, size: number | null }[]
  task: { test: string, skill: string, partNumber: number | null, to: string, done: boolean } | null
  live: LiveLesson | null
  exercises: LessonExerciseSummary[]
  canMarkDone: boolean
  requiredPending: number
  drip: DripState
  done: boolean
  course: { id: string, slug: string, title: string, teaches: boolean, dripMode: string }
  outline: Array<{ id: string, title: string, lessons: Array<{ id: string, title: string, done: boolean, locked: boolean }> }>
  position: number
  of: number
  prev: { id: string, title: string } | null
  next: { id: string, title: string, locked: boolean } | null
}

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const slug = String(route.params.slug)

const { data: l, error, refresh } = await useFetch<LessonView>(() => `/api/course-lessons/${route.params.lesson}`)

const dripLocked = computed(() => {
  const err = error.value as any
  if (err?.statusCode === 403 && err?.data?.data?.code === 'DRIP_LOCKED') {
    return err.data.data.drip as DripState
  }
  return null
})

if (error.value?.statusCode === 403 && !dripLocked.value) {
  await navigateTo(`/courses/${slug}`)
} else if (error.value && !dripLocked.value) {
  throw createError({ statusCode: 404, statusMessage: t('courses.lessonNotFound'), fatal: true })
}

useSeoMeta({ title: () => (l.value ? `${l.value.title} · ${l.value.course.title}` : t('nav.courses')), robots: 'noindex' })

const embed = computed(() => videoEmbed(l.value?.videoUrl))
const sizeText = (n: number | null) => (n == null ? '' : n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
const taskName = computed(() => (l.value?.task ? `${skillLabel(l.value.task.skill)}${l.value.task.partNumber ? ` · ${partName(l.value.task.skill, l.value.task.partNumber)}` : ''}` : ''))

const activeExerciseId = ref<string | null>(null)
watch(l, (v) => {
  if (!v?.exercises?.length) activeExerciseId.value = null
  else if (!activeExerciseId.value || !v.exercises.some(e => e.id === activeExerciseId.value)) {
    activeExerciseId.value = v.exercises[0]!.id
  }
}, { immediate: true })

const busy = ref(false)
async function toggleDone() {
  if (!l.value) return
  busy.value = true
  try {
    await $fetch(`/api/course-lessons/${l.value.id}/done`, { method: l.value.done ? 'DELETE' : 'POST' })
    await refresh()
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    busy.value = false
  }
}

async function onExerciseCompleted() {
  await refresh()
}
</script>

<template>
  <!-- Content Drip Lock Screen -->
  <AppPage
    v-if="dripLocked"
    title="Lesson Locked"
    icon="i-lucide-lock"
    :back="`/courses/${slug}`"
  >
    <UCard
      class="max-w-lg mx-auto"
      :ui="{ body: 'p-8 text-center flex flex-col items-center gap-4' }"
    >
      <div class="size-14 rounded-2xl bg-warning/15 text-warning grid place-items-center">
        <UIcon
          name="i-lucide-calendar-clock"
          class="size-7"
        />
      </div>
      <div>
        <h1 class="text-xl font-bold text-highlighted">
          {{ dripLocked.reason === 'PREVIOUS_INCOMPLETE' ? 'Complete the previous lesson first' : dripLocked.reason === 'DATE_EXPIRED' ? 'This lesson window has ended' : 'This lesson is scheduled to unlock soon' }}
        </h1>
        <p class="text-sm text-muted mt-1.5">
          <template v-if="dripLocked.reason === 'PREVIOUS_INCOMPLETE'">
            This course releases lessons sequentially. Finish <strong>{{ dripLocked.previousLessonTitle || 'the previous lesson' }}</strong> to unlock this one automatically.
          </template>
          <template v-else-if="dripLocked.reason === 'DATE_NOT_STARTED' && dripLocked.availableFrom">
            Available starting <strong>{{ new Date(dripLocked.availableFrom).toLocaleString() }}</strong>.
          </template>
          <template v-else-if="dripLocked.reason === 'DATE_EXPIRED' && dripLocked.availableTo">
            Closed on <strong>{{ new Date(dripLocked.availableTo).toLocaleString() }}</strong>.
          </template>
        </p>
      </div>
      <div class="flex flex-wrap justify-center gap-2">
        <UButton
          v-if="dripLocked.previousLessonId"
          :to="`/courses/${slug}/${dripLocked.previousLessonId}`"
          label="Go to Previous Lesson"
          icon="i-lucide-arrow-left"
        />
        <UButton
          :to="`/courses/${slug}`"
          label="Back to Course Outline"
          color="neutral"
          variant="outline"
        />
      </div>
    </UCard>
  </AppPage>

  <!-- Active Lesson Player -->
  <AppPage
    v-else-if="l"
    :title="l.course.title"
    icon="i-lucide-graduation-cap"
    :back="`/courses/${l.course.slug}`"
    wide
  >
    <div class="mx-auto w-full max-w-6xl grid lg:grid-cols-[270px_minmax(0,1fr)] gap-6 items-start">
      <!-- Curriculum Outline Sidebar -->
      <aside class="hidden lg:flex flex-col gap-3 sticky top-4 rounded-2xl ring ring-default bg-default p-4 max-h-[calc(100vh-7rem)] overflow-y-auto">
        <p class="text-xs font-bold uppercase tracking-wider text-muted">
          Course Curriculum
        </p>
        <div
          v-for="(unit, uIdx) in l.outline"
          :key="unit.id"
          class="flex flex-col gap-1"
        >
          <p class="text-xs font-semibold text-highlighted px-2 pt-1">
            {{ uIdx + 1 }}. {{ unit.title }}
          </p>
          <component
            :is="item.locked ? 'div' : resolveComponent('NuxtLink')"
            v-for="item in unit.lessons"
            :key="item.id"
            :to="item.locked ? undefined : `/courses/${l.course.slug}/${item.id}`"
            class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors"
            :class="item.id === l.id
              ? 'bg-primary/10 text-primary font-semibold'
              : item.locked
                ? 'text-dimmed opacity-65'
                : 'text-toned hover:bg-elevated'"
          >
            <UIcon
              :name="item.done ? 'i-lucide-circle-check' : item.locked ? 'i-lucide-lock' : 'i-lucide-circle'"
              class="size-3.5 shrink-0"
              :class="item.done ? 'text-success' : ''"
            />
            <span class="truncate">{{ item.title }}</span>
          </component>
        </div>
      </aside>

      <!-- Main Lesson Content -->
      <article class="flex flex-col gap-5 min-w-0">
        <div>
          <div class="flex flex-wrap items-center gap-2 text-xs text-muted mb-1">
            <UBadge
              v-if="l.module"
              :label="`Unit ${l.module.position}: ${l.module.title}`"
              color="primary"
              variant="subtle"
              size="xs"
            />
            <span>{{ t('courses.lessonOf', { n: l.position, of: l.of }) }}</span>
            <span v-if="l.durationMinutes">· {{ l.durationMinutes }} min</span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-bold text-highlighted">
            {{ l.title }}
          </h1>
          <p
            v-if="l.summary"
            class="text-sm text-muted mt-1"
          >
            {{ l.summary }}
          </p>
        </div>

        <div
          v-if="embed"
          class="aspect-video w-full overflow-hidden rounded-xl ring ring-default bg-black"
        >
          <iframe
            :src="embed"
            class="size-full"
            :title="l.title"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowfullscreen
            loading="lazy"
            referrerpolicy="strict-origin-when-cross-origin"
          />
        </div>
        <UButton
          v-else-if="l.videoUrl"
          :href="l.videoUrl"
          target="_blank"
          rel="noopener"
          :label="t('courses.watchVideo')"
          icon="i-lucide-play-circle"
          color="neutral"
          variant="outline"
          class="self-start"
        />

        <UCard
          v-if="l.live"
          :ui="{ body: 'p-0' }"
        >
          <OnlineRow :lesson="l.live" />
        </UCard>

        <div
          v-if="l.body"
          class="rich-content leading-7"
          v-html="l.body"
        />

        <!-- Interactive LMS Exercises Section -->
        <section
          v-if="l.exercises.length"
          class="flex flex-col gap-4 pt-2 border-t border-default"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-lg font-bold text-highlighted flex items-center gap-2">
              <UIcon
                name="i-lucide-list-checks"
                class="size-5 text-primary"
              />
              Interactive Exercises ({{ l.exercises.length }})
            </h2>
            <div
              v-if="l.exercises.length > 1"
              class="flex flex-wrap gap-1.5"
            >
              <UButton
                v-for="(ex, idx) in l.exercises"
                :key="ex.id"
                :label="`${idx + 1}. ${ex.title}${ex.passed ? ' ✓' : ''}`"
                size="xs"
                :color="activeExerciseId === ex.id ? 'primary' : ex.passed ? 'success' : 'neutral'"
                :variant="activeExerciseId === ex.id ? 'solid' : 'soft'"
                @click="activeExerciseId = ex.id"
              />
            </div>
          </div>

          <LmsExercisePlayer
            v-if="activeExerciseId"
            :key="activeExerciseId"
            :exercise-id="activeExerciseId"
            @completed="onExerciseCompleted"
          />
        </section>

        <!-- Linked Exam Platform Practice Task -->
        <UCard
          v-if="l.task"
          :ui="{ body: 'p-4 flex flex-wrap items-center gap-3' }"
          data-testid="lesson-task"
        >
          <UIcon
            :name="l.task.done ? 'i-lucide-circle-check' : 'i-lucide-clipboard-check'"
            class="size-6 shrink-0"
            :class="l.task.done ? 'text-success' : 'text-primary'"
          />
          <div class="flex-1 min-w-48">
            <p class="text-sm font-medium text-highlighted">
              {{ t('courses.taskTitle') }}: {{ taskName }}
            </p>
            <p class="text-xs text-muted">
              {{ l.task.test }}{{ l.task.done ? ` · ${t('courses.taskDone')}` : '' }}
            </p>
          </div>
          <UButton
            :to="l.task.to"
            :label="l.task.done ? t('courses.taskAgain') : t('courses.taskStart')"
            :color="l.task.done ? 'neutral' : 'primary'"
            :variant="l.task.done ? 'outline' : 'solid'"
            trailing-icon="i-lucide-arrow-right"
          />
        </UCard>

        <!-- Downloadable Handouts -->
        <div
          v-if="l.files.length"
          class="flex flex-col gap-2"
        >
          <p class="text-sm font-semibold text-highlighted">
            {{ t('courses.files') }}
          </p>
          <a
            v-for="f in l.files"
            :key="f.url"
            :href="f.url"
            target="_blank"
            rel="noopener"
            class="flex items-center gap-3 rounded-lg ring ring-default px-3 py-2 hover:bg-elevated/50"
          >
            <UIcon
              name="i-lucide-file-text"
              class="size-5 text-error shrink-0"
            />
            <span class="flex-1 min-w-0 truncate text-sm">{{ f.name }}</span>
            <span class="text-xs text-muted">{{ sizeText(f.size) }}</span>
            <UIcon
              name="i-lucide-download"
              class="size-4 text-muted"
            />
          </a>
        </div>

        <!-- Completion & Prev/Next Bar -->
        <div class="flex flex-wrap items-center gap-2 border-t border-default pt-4">
          <div
            v-if="!l.course.teaches"
            class="flex flex-col gap-1"
          >
            <UButton
              :label="l.done ? t('courses.doneMarked') : t('courses.markDone')"
              :icon="l.done ? 'i-lucide-circle-check' : 'i-lucide-check'"
              :color="l.done ? 'success' : 'primary'"
              :variant="l.done ? 'soft' : 'solid'"
              :loading="busy"
              :disabled="!l.done && !l.canMarkDone"
              data-testid="mark-done"
              @click="toggleDone"
            />
            <span
              v-if="!l.done && l.requiredPending > 0"
              class="text-xs text-warning"
            >
              Pass {{ l.requiredPending }} required exercise{{ l.requiredPending === 1 ? '' : 's' }} above to complete this lesson.
            </span>
          </div>
          <span class="flex-1" />
          <UButton
            v-if="l.prev"
            :to="`/courses/${l.course.slug}/${l.prev.id}`"
            :label="t('courses.prev')"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
          />
          <UButton
            v-if="l.next"
            :to="l.next.locked ? undefined : `/courses/${l.course.slug}/${l.next.id}`"
            :disabled="l.next.locked"
            :label="l.next.locked ? 'Next (Locked)' : t('courses.next')"
            :trailing-icon="l.next.locked ? 'i-lucide-lock' : 'i-lucide-arrow-right'"
            color="neutral"
            variant="outline"
          />
        </div>
      </article>
    </div>
  </AppPage>
</template>
