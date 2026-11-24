<script setup lang="ts">
import type { CourseCard } from '~/components/course/Card.vue'
import type { DripMode, DripState } from '#shared/utils/lms'

/**
 * Student Course Overview: structured into Units/Modules => Lessons with Content Drip badges,
 * exercise counts, and enrollment/progress tracking.
 */
definePageMeta({ guestLayout: true })

interface LessonRow {
  id: string
  moduleId: string | null
  position: number
  title: string
  summary: string | null
  durationMinutes: number | null
  exerciseCount: number
  has: { text: boolean, video: boolean, task: boolean, files: boolean, live: boolean, exercises: boolean }
  done: boolean
  taskDone: boolean
  drip: DripState
}
interface ModuleView {
  id: string
  position: number
  title: string
  description: string | null
  dripMode: string | null
  availableFrom: string | null
  availableTo: string | null
  lessons: LessonRow[]
}
interface CourseView extends Omit<CourseCard, 'lessons'> {
  dripMode: DripMode
  dripStartAt: string | null
  dripEndAt: string | null
  access: { teaches: boolean, see: boolean, learn: boolean, enrolled: boolean, canEnroll: boolean }
  modules: ModuleView[]
  lessons: LessonRow[]
}

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const { loggedIn } = useMe()
const slug = String(route.params.slug)
const { data: c, error, refresh } = await useFetch<CourseView>(`/api/courses/${slug}`)
if (error.value || !c.value) throw createError({ statusCode: 404, statusMessage: t('courses.notFound'), fatal: true })

useSeoMeta({
  title: () => c.value!.title,
  description: () => c.value!.summary || t('courses.seoCourse', { title: c.value!.title }),
  ogTitle: () => c.value!.title,
  ogDescription: () => c.value!.summary || t('courses.seoCourse', { title: c.value!.title }),
  robots: () => (c.value!.visibility === 'PUBLIC' && c.value!.published ? undefined : 'noindex')
})

const meta = computed(() => [
  c.value!.teacher?.name,
  `${c.value!.modules.length} unit${c.value!.modules.length === 1 ? '' : 's'}`,
  t('courses.lessons', { n: c.value!.lessons.length }, c.value!.lessons.length),
  c.value!.visibility === 'PUBLIC' ? t('courses.learners', { n: c.value!.learners }, c.value!.learners) : null
].filter(Boolean).join(' · '))

const done = computed(() => c.value!.lessons.filter(l => l.done).length)
const progress = computed(() => (c.value!.lessons.length ? Math.round(done.value / c.value!.lessons.length * 100) : 0))
const nextLesson = computed(() => c.value!.lessons.find(l => !l.done && !l.drip.locked) ?? c.value!.lessons.find(l => !l.drip.locked) ?? c.value!.lessons[0] ?? null)

const collapsedUnits = ref<Record<string, boolean>>({})
function toggleUnit(id: string) {
  collapsedUnits.value[id] = !collapsedUnits.value[id]
}

const busy = ref(false)
async function enroll() {
  busy.value = true
  try {
    await $fetch(`/api/courses/${c.value!.id}/enroll`, { method: 'POST' })
    await refresh()
    toast.add({ title: t('courses.enrolled'), color: 'success' })
  } catch (e) {
    toast.add({ title: t('courses.notEnrolled'), description: errorMessage(e), color: 'error' })
  } finally {
    busy.value = false
  }
}
async function leave() {
  if (!confirm(t('courses.leaveSure'))) return
  await $fetch(`/api/courses/${c.value!.id}/enroll`, { method: 'DELETE' }).catch(() => {})
  await refresh()
}

const icons = (l: LessonRow) => [
  l.has.video && 'i-lucide-play-circle',
  l.has.text && 'i-lucide-file-text',
  l.has.exercises && 'i-lucide-list-checks',
  l.has.task && 'i-lucide-clipboard-check',
  l.has.files && 'i-lucide-paperclip',
  l.has.live && 'i-lucide-video'
].filter(Boolean) as string[]

const fmtDate = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

function lockLabel(drip: DripState): string {
  if (drip.reason === 'DATE_NOT_STARTED' && drip.availableFrom) return `Opens ${fmtDate(drip.availableFrom)}`
  if (drip.reason === 'DATE_EXPIRED') return 'Closed'
  if (drip.reason === 'PREVIOUS_INCOMPLETE') return 'Complete previous lesson'
  return 'Locked'
}
</script>

<template>
  <AppPage
    :title="c!.title"
    icon="i-lucide-graduation-cap"
    back="/courses"
  >
    <template #actions>
      <UButton
        v-if="c!.access.teaches"
        :to="`/courses/manage/${c!.id}`"
        :label="t('courses.edit')"
        icon="i-lucide-pencil"
        color="neutral"
        variant="outline"
      />
    </template>

    <div class="flex flex-col gap-6 max-w-4xl w-full">
      <section class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center gap-1.5">
          <UBadge
            v-if="c!.exam"
            :label="examLabel(c!.exam)"
            color="primary"
            variant="subtle"
          />
          <UBadge
            v-if="c!.level"
            :label="c!.level"
            color="neutral"
            variant="subtle"
          />
          <UBadge
            :label="DRIP_MODE_META[c!.dripMode ?? 'ALWAYS_OPEN'].label"
            :icon="DRIP_MODE_META[c!.dripMode ?? 'ALWAYS_OPEN'].icon"
            color="info"
            variant="soft"
          />
          <UBadge
            v-if="c!.visibility === 'PRIVATE'"
            :label="t('courses.forStudents')"
            icon="i-lucide-lock"
            color="neutral"
            variant="outline"
          />
        </div>
        <h1 class="text-2xl sm:text-3xl font-bold text-highlighted">
          {{ c!.title }}
        </h1>
        <p
          v-if="c!.summary"
          class="text-toned sm:text-lg"
        >
          {{ c!.summary }}
        </p>
        <div class="flex items-center gap-2 text-sm text-muted">
          <UAvatar
            v-if="c!.teacher"
            :src="c!.teacher.avatarUrl ?? undefined"
            :alt="c!.teacher.name"
            size="xs"
          />
          <span>{{ meta }}</span>
        </div>

        <UCard
          v-if="!c!.access.teaches"
          :ui="{ body: 'p-4 flex flex-wrap items-center gap-3' }"
          data-testid="course-cta"
        >
          <template v-if="c!.access.learn">
            <div class="flex-1 min-w-48">
              <p class="text-sm font-medium text-highlighted">
                {{ t('courses.progress', { done, of: c!.lessons.length }) }} ({{ progress }}%)
              </p>
              <UProgress
                :model-value="progress"
                size="sm"
                class="mt-2"
              />
            </div>
            <UButton
              v-if="nextLesson && !nextLesson.drip.locked"
              :to="`/courses/${c!.slug}/${nextLesson.id}`"
              :label="done ? t('courses.continue') : t('courses.start')"
              trailing-icon="i-lucide-arrow-right"
            />
            <UButton
              v-if="c!.visibility === 'PUBLIC'"
              :label="t('courses.leave')"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="leave"
            />
          </template>
          <template v-else>
            <p class="flex-1 min-w-48 text-sm text-muted">
              {{ t('courses.enrollText') }}
            </p>
            <UButton
              v-if="loggedIn"
              :label="t('courses.enroll')"
              icon="i-lucide-plus"
              :loading="busy"
              data-testid="enroll"
              @click="enroll"
            />
            <UButton
              v-else
              :to="`/login?next=${encodeURIComponent(route.fullPath)}`"
              :label="t('courses.signInToEnroll')"
              icon="i-lucide-log-in"
            />
          </template>
        </UCard>
      </section>

      <!-- Curriculum grouped by Units / Modules -->
      <section class="flex flex-col gap-3">
        <h2 class="font-semibold text-highlighted text-lg">
          Curriculum
        </h2>

        <template v-if="c!.modules.length">
          <UCard
            v-for="(mod, mIdx) in c!.modules"
            :key="mod.id"
            :ui="{ body: 'p-0' }"
          >
            <button
              type="button"
              class="w-full flex items-center gap-3 px-4 py-3.5 bg-elevated/40 hover:bg-elevated/70 transition-colors text-start cursor-pointer"
              :class="!collapsedUnits[mod.id] && mod.lessons.length ? 'border-b border-default' : ''"
              @click="toggleUnit(mod.id)"
            >
              <UBadge
                :label="`Unit ${mIdx + 1}`"
                color="primary"
                variant="subtle"
                size="xs"
              />
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-highlighted text-sm sm:text-base truncate">
                  {{ mod.title }}
                </p>
                <p
                  v-if="mod.description"
                  class="text-xs text-muted truncate"
                >
                  {{ mod.description }}
                </p>
              </div>
              <span class="text-xs text-muted tabular-nums shrink-0">
                {{ mod.lessons.filter(l => l.done).length }}/{{ mod.lessons.length }} done
              </span>
              <UIcon
                name="i-lucide-chevron-down"
                class="size-4 text-muted transition-transform shrink-0"
                :class="collapsedUnits[mod.id] ? '-rotate-90' : ''"
              />
            </button>

            <ol
              v-if="!collapsedUnits[mod.id] && mod.lessons.length"
              class="divide-y divide-default"
            >
              <li
                v-for="l in mod.lessons"
                :key="l.id"
              >
                <component
                  :is="c!.access.learn && !l.drip.locked ? resolveComponent('NuxtLink') : 'div'"
                  :to="c!.access.learn && !l.drip.locked ? `/courses/${c!.slug}/${l.id}` : undefined"
                  class="flex items-center gap-3 px-4 py-3 transition-colors"
                  :class="c!.access.learn && !l.drip.locked ? 'hover:bg-elevated/50' : 'opacity-70'"
                  data-testid="lesson-row"
                >
                  <span
                    class="size-7 shrink-0 rounded-full grid place-items-center text-xs font-semibold"
                    :class="l.done ? 'bg-success text-white' : l.drip.locked ? 'bg-elevated text-dimmed' : 'bg-elevated text-toned'"
                  >
                    <UIcon
                      v-if="l.done"
                      name="i-lucide-check"
                      class="size-4"
                    />
                    <UIcon
                      v-else-if="l.drip.locked"
                      name="i-lucide-lock"
                      class="size-3.5"
                    />
                    <template v-else>{{ l.position }}</template>
                  </span>
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-highlighted truncate text-sm sm:text-base">
                      {{ l.title }}
                    </p>
                    <div class="flex flex-wrap items-center gap-2 text-xs text-muted mt-0.5">
                      <span v-if="l.durationMinutes">{{ l.durationMinutes }} min</span>
                      <span
                        v-if="l.exerciseCount"
                        class="text-primary font-medium"
                      >
                        {{ l.exerciseCount }} exercise{{ l.exerciseCount === 1 ? '' : 's' }}
                      </span>
                      <span
                        v-if="l.drip.locked && c!.access.learn"
                        class="text-warning font-medium"
                      >
                        {{ lockLabel(l.drip) }}
                      </span>
                    </div>
                  </div>
                  <span class="hidden sm:flex items-center gap-1.5 text-muted">
                    <UIcon
                      v-for="i in icons(l)"
                      :key="i"
                      :name="i"
                      class="size-4"
                    />
                  </span>
                  <UIcon
                    v-if="!c!.access.learn || l.drip.locked"
                    name="i-lucide-lock"
                    class="size-4 text-dimmed shrink-0"
                  />
                  <UIcon
                    v-else
                    name="i-lucide-chevron-right"
                    class="size-4 text-muted shrink-0"
                  />
                </component>
              </li>
            </ol>
          </UCard>
        </template>

        <p
          v-else
          class="text-sm text-muted"
        >
          {{ t('courses.noLessons') }}
        </p>
      </section>
    </div>
  </AppPage>
</template>
