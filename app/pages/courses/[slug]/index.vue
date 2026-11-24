<script setup lang="ts">
import type { CourseCard } from '~/components/course/Card.vue'
import type { DripMode, DripState } from '#shared/utils/lms'

/**
 * A course's page, for anyone who may see it: what it is (cover or intro video, summary, what
 * learners will learn, the description, requirements, who it is for), its curriculum by topic with
 * each lesson's contents and whether it is open yet, and beside it the way in (enroll, or the next
 * lesson and the learner's progress) with what the course includes. A public course is for search
 * engines too; a private one is not.
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
  coverUrl: string | null
  description: string | null
  introVideoUrl: string | null
  outcomes: string[]
  requirements: string[]
  audience: string[]
  totalMinutes: number
  exerciseTotal: number
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

const embed = computed(() => videoEmbed(c.value!.introVideoUrl))
const duration = (min: number) => (min >= 60 ? t('builder.hoursMinutes', { h: Math.floor(min / 60), m: min % 60 }) : t('builder.minutes', { n: min }))
/** What the course includes, for the card beside it. */
const includes = computed(() => [
  { icon: 'i-lucide-book-open', label: t('courses.lessons', { n: c.value!.lessons.length }, c.value!.lessons.length) },
  c.value!.totalMinutes ? { icon: 'i-lucide-clock', label: t('coursePage.totalTime', { time: duration(c.value!.totalMinutes) }) } : null,
  c.value!.exerciseTotal ? { icon: 'i-lucide-list-checks', label: t('builder.quizCount', { n: c.value!.exerciseTotal }, c.value!.exerciseTotal) } : null,
  c.value!.lessons.some(l => l.has.live) ? { icon: 'i-lucide-video', label: t('coursePage.liveClasses') } : null,
  c.value!.lessons.some(l => l.has.files) ? { icon: 'i-lucide-paperclip', label: t('coursePage.downloads') } : null,
  { icon: 'i-lucide-calendar-clock', label: t(`builder.drip.${c.value!.dripMode ?? 'ALWAYS_OPEN'}`) },
  c.value!.visibility === 'PUBLIC' ? { icon: 'i-lucide-users', label: t('courses.learners', { n: c.value!.learners }, c.value!.learners) } : null
].filter(Boolean) as { icon: string, label: string }[])
const topicLabel = (m: ModuleView, i: number) => (m.id === '__ungrouped__' ? t(c.value!.modules.length > 1 ? 'builder.outsideTopicsTitle' : 'courses.lessonsTitle') : t('builder.topicN', { n: i + 1 }))

const done = computed(() => c.value!.lessons.filter(l => l.done).length)
const progress = computed(() => (c.value!.lessons.length ? Math.round(done.value / c.value!.lessons.length * 100) : 0))
const nextLesson = computed(() => c.value!.lessons.find(l => !l.done && !l.drip.locked) ?? c.value!.lessons.find(l => !l.drip.locked) ?? c.value!.lessons[0] ?? null)

const folded = ref<Record<string, boolean>>({})
const toggle = (id: string) => (folded.value[id] = !folded.value[id])

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
const { confirm } = useDialogs()
async function leave() {
  if (!await confirm({ title: t('courses.leaveSure'), confirmLabel: t('courses.leave') })) return
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

const { locale } = useI18n()
const fmtDate = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : localeDate(d, locale.value, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function lockLabel(drip: DripState): string {
  if (drip.reason === 'DATE_NOT_STARTED' && drip.availableFrom) return t('builder.opensOn', { date: fmtDate(drip.availableFrom) })
  if (drip.reason === 'DATE_EXPIRED') return t('coursePage.closed')
  if (drip.reason === 'PREVIOUS_INCOMPLETE') return t('coursePage.afterPrevious')
  return t('coursePage.locked')
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

    <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] items-start w-full max-w-6xl">
      <div class="flex flex-col gap-8 min-w-0">
        <header class="flex flex-col gap-3">
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
              variant="outline"
            />
            <UBadge
              v-if="c!.visibility === 'PRIVATE'"
              :label="t('courses.forStudents')"
              icon="i-lucide-lock"
              color="neutral"
              variant="outline"
            />
          </div>
          <h1 class="text-2xl sm:text-4xl font-bold text-highlighted text-balance">
            {{ c!.title }}
          </h1>
          <p
            v-if="c!.summary"
            class="text-toned sm:text-lg text-pretty max-w-[65ch]"
          >
            {{ c!.summary }}
          </p>
          <div
            v-if="c!.teacher"
            class="flex items-center gap-2 text-sm text-muted"
          >
            <UAvatar
              :src="c!.teacher.avatarUrl ?? undefined"
              :alt="c!.teacher.name"
              size="sm"
            />
            <span>{{ t('coursePage.by', { name: c!.teacher.name }) }}</span>
          </div>
        </header>

        <div
          v-if="embed || c!.coverUrl"
          class="aspect-video rounded-xl overflow-hidden bg-elevated ring ring-default"
        >
          <iframe
            v-if="embed"
            :src="embed"
            class="size-full"
            :title="c!.title"
            allow="encrypted-media; picture-in-picture; fullscreen"
            allowfullscreen
          />
          <img
            v-else
            :src="c!.coverUrl!"
            :alt="c!.title"
            class="size-full object-cover"
          >
        </div>

        <section
          v-if="c!.outcomes.length"
          class="rounded-xl ring ring-default p-5 sm:p-6"
          data-testid="outcomes"
        >
          <h2 class="text-lg font-semibold text-highlighted mb-4">
            {{ t('builder.outcomes') }}
          </h2>
          <ul class="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <li
              v-for="o in c!.outcomes"
              :key="o"
              class="flex gap-2.5 text-toned"
            >
              <UIcon
                name="i-lucide-check"
                class="size-5 text-primary shrink-0 mt-px"
              />{{ o }}
            </li>
          </ul>
        </section>

        <section
          v-if="c!.description"
          class="flex flex-col gap-3"
        >
          <h2 class="text-lg font-semibold text-highlighted">
            {{ t('coursePage.about') }}
          </h2>
          <!-- eslint-disable-next-line vue/no-v-html -- sanitized on the server -->
          <div
            class="rich-content leading-7 max-w-[70ch] text-toned [&_a]:text-primary [&_a]:underline"
            v-html="c!.description"
          />
        </section>

        <section class="flex flex-col gap-3">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <h2 class="text-lg font-semibold text-highlighted">
              {{ t('coursePage.curriculum') }}
            </h2>
            <p class="text-sm text-muted">
              {{ [t('builder.topicCount', { n: c!.modules.filter(m => m.id !== '__ungrouped__').length }, c!.modules.filter(m => m.id !== '__ungrouped__').length), t('courses.lessons', { n: c!.lessons.length }, c!.lessons.length), c!.totalMinutes ? duration(c!.totalMinutes) : null].filter(Boolean).join(' · ') }}
            </p>
          </div>

          <div
            v-if="c!.modules.length"
            class="rounded-xl ring ring-default divide-y divide-default overflow-hidden"
          >
            <section
              v-for="(mod, mIdx) in c!.modules"
              :key="mod.id"
            >
              <button
                type="button"
                class="w-full flex items-center gap-3 px-4 py-3.5 bg-muted hover:bg-elevated/60 transition-colors text-start cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                :aria-expanded="!folded[mod.id]"
                @click="toggle(mod.id)"
              >
                <UIcon
                  name="i-lucide-chevron-right"
                  class="size-4 text-muted transition-transform duration-200 shrink-0"
                  :class="folded[mod.id] ? '' : 'rotate-90'"
                />
                <div class="flex-1 min-w-0">
                  <p class="text-xs text-muted">
                    {{ topicLabel(mod, mIdx) }}
                  </p>
                  <p class="font-semibold text-highlighted truncate">
                    {{ mod.title === 'Additional Lessons' || mod.title === 'Course Lessons' ? topicLabel(mod, mIdx) : mod.title }}
                  </p>
                </div>
                <span class="text-xs text-muted tabular-nums shrink-0">
                  <template v-if="c!.access.learn">{{ mod.lessons.filter(l => l.done).length }}/</template>{{ t('courses.lessons', { n: mod.lessons.length }, mod.lessons.length) }}
                </span>
              </button>
              <p
                v-if="!folded[mod.id] && mod.description"
                class="px-4 pt-3 text-sm text-muted"
              >
                {{ mod.description }}
              </p>
              <ol
                v-if="!folded[mod.id] && mod.lessons.length"
                class="py-1"
              >
                <li
                  v-for="l in mod.lessons"
                  :key="l.id"
                >
                  <component
                    :is="c!.access.learn && !l.drip.locked ? resolveComponent('NuxtLink') : 'div'"
                    :to="c!.access.learn && !l.drip.locked ? `/courses/${c!.slug}/${l.id}` : undefined"
                    class="flex items-center gap-3 px-4 py-2.5"
                    :class="c!.access.learn && !l.drip.locked ? 'hover:bg-elevated/50' : ''"
                    data-testid="lesson-row"
                  >
                    <span
                      class="size-7 shrink-0 rounded-full grid place-items-center text-xs font-semibold"
                      :class="l.done ? 'bg-success text-inverted' : 'bg-elevated text-toned'"
                    >
                      <UIcon
                        v-if="l.done"
                        name="i-lucide-check"
                        class="size-4"
                      />
                      <template v-else>{{ l.position }}</template>
                    </span>
                    <div class="flex-1 min-w-0">
                      <p
                        class="font-medium truncate"
                        :class="l.drip.locked && c!.access.learn ? 'text-muted' : 'text-highlighted'"
                      >
                        {{ l.title }}
                      </p>
                      <p class="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        <span v-if="l.durationMinutes">{{ duration(l.durationMinutes) }}</span>
                        <span v-if="l.exerciseCount">{{ t('builder.quizCount', { n: l.exerciseCount }, l.exerciseCount) }}</span>
                        <span v-if="l.drip.locked && c!.access.learn">{{ lockLabel(l.drip) }}</span>
                      </p>
                    </div>
                    <span class="hidden sm:flex items-center gap-1.5 text-dimmed">
                      <UIcon
                        v-for="i in icons(l)"
                        :key="i"
                        :name="i"
                        class="size-4"
                      />
                    </span>
                    <UIcon
                      :name="!c!.access.learn || l.drip.locked ? 'i-lucide-lock' : 'i-lucide-chevron-right'"
                      class="size-4 shrink-0"
                      :class="!c!.access.learn || l.drip.locked ? 'text-dimmed' : 'text-muted'"
                    />
                  </component>
                </li>
              </ol>
            </section>
          </div>
          <p
            v-else
            class="text-sm text-muted"
          >
            {{ t('courses.noLessons') }}
          </p>
        </section>

        <div
          v-if="c!.requirements.length || c!.audience.length"
          class="grid gap-8 sm:grid-cols-2"
        >
          <section v-if="c!.requirements.length">
            <h2 class="text-lg font-semibold text-highlighted mb-3">
              {{ t('builder.requirements') }}
            </h2>
            <ul class="flex flex-col gap-2 text-toned">
              <li
                v-for="r in c!.requirements"
                :key="r"
                class="flex gap-2.5"
              >
                <UIcon
                  name="i-lucide-dot"
                  class="size-5 shrink-0 text-muted"
                />{{ r }}
              </li>
            </ul>
          </section>
          <section v-if="c!.audience.length">
            <h2 class="text-lg font-semibold text-highlighted mb-3">
              {{ t('builder.audience') }}
            </h2>
            <ul class="flex flex-col gap-2 text-toned">
              <li
                v-for="a in c!.audience"
                :key="a"
                class="flex gap-2.5"
              >
                <UIcon
                  name="i-lucide-dot"
                  class="size-5 shrink-0 text-muted"
                />{{ a }}
              </li>
            </ul>
          </section>
        </div>
      </div>

      <aside class="lg:sticky lg:top-6 flex flex-col gap-4 order-first lg:order-none">
        <UCard
          :ui="{ body: 'p-0 sm:p-0' }"
          data-testid="course-cta"
        >
          <img
            v-if="c!.coverUrl && embed"
            :src="c!.coverUrl"
            :alt="c!.title"
            class="hidden lg:block aspect-video w-full object-cover rounded-t-xl"
          >
          <div class="p-5 flex flex-col gap-4">
            <template v-if="c!.access.teaches">
              <p class="text-sm text-muted">
                {{ c!.published ? (c!.visibility === 'PUBLIC' ? t('courses.livepublic') : t('courses.liveprivate')) : t('courses.draftText') }}
              </p>
              <UButton
                :to="`/courses/manage/${c!.id}`"
                :label="t('courses.edit')"
                icon="i-lucide-pencil"
                block
                size="lg"
              />
            </template>
            <template v-else-if="c!.access.learn">
              <div>
                <div class="flex items-baseline justify-between gap-2">
                  <p class="text-sm font-medium text-highlighted">
                    {{ t('courses.progress', { done, of: c!.lessons.length }) }}
                  </p>
                  <span class="text-sm tabular-nums text-muted">{{ progress }}%</span>
                </div>
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
                block
                size="lg"
              />
              <UButton
                v-if="c!.visibility === 'PUBLIC'"
                :label="t('courses.leave')"
                color="neutral"
                variant="ghost"
                size="sm"
                class="self-center"
                @click="leave"
              />
            </template>
            <template v-else>
              <p class="text-2xl font-bold text-highlighted">
                {{ t('coursePage.free') }}
              </p>
              <UButton
                v-if="loggedIn"
                :label="t('courses.enroll')"
                icon="i-lucide-plus"
                :loading="busy"
                block
                size="lg"
                data-testid="enroll"
                @click="enroll"
              />
              <UButton
                v-else
                :to="`/login?next=${encodeURIComponent(route.fullPath)}`"
                :label="t('courses.signInToEnroll')"
                icon="i-lucide-log-in"
                block
                size="lg"
              />
              <p class="text-xs text-muted">
                {{ t('courses.enrollText') }}
              </p>
            </template>

            <USeparator />
            <div>
              <p class="text-sm font-semibold text-highlighted mb-2.5">
                {{ t('coursePage.includes') }}
              </p>
              <ul class="flex flex-col gap-2 text-sm text-toned">
                <li
                  v-for="i in includes"
                  :key="i.icon + i.label"
                  class="flex items-center gap-2.5"
                >
                  <UIcon
                    :name="i.icon"
                    class="size-4 text-muted shrink-0"
                  />{{ i.label }}
                </li>
              </ul>
            </div>
          </div>
        </UCard>
      </aside>
    </div>
  </AppPage>
</template>
