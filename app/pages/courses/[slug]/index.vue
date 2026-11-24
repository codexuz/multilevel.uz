<script setup lang="ts">
import type { CourseCard } from '~/components/course/Card.vue'

/**
 * A course's page: what it is, who teaches it, its lessons (what each holds, and which I did), and
 * the way in: Enroll for a public course (free), the first lesson for a private course's students.
 * A public course is for search engines too; a private one is not.
 */
definePageMeta({ guestLayout: true })
interface LessonRow { id: string, position: number, title: string, has: { text: boolean, video: boolean, task: boolean, files: boolean, live: boolean }, done: boolean, taskDone: boolean }
interface CourseView extends Omit<CourseCard, 'lessons'> { access: { teaches: boolean, see: boolean, learn: boolean, enrolled: boolean, canEnroll: boolean }, lessons: LessonRow[] }

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
  t('courses.lessons', { n: c.value!.lessons.length }, c.value!.lessons.length),
  c.value!.visibility === 'PUBLIC' ? t('courses.learners', { n: c.value!.learners }, c.value!.learners) : null
].filter(Boolean).join(' · '))
const done = computed(() => c.value!.lessons.filter(l => l.done).length)
const progress = computed(() => (c.value!.lessons.length ? Math.round(done.value / c.value!.lessons.length * 100) : 0))
const nextLesson = computed(() => c.value!.lessons.find(l => !l.done) ?? c.value!.lessons[0] ?? null)

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
  l.has.text && 'i-lucide-file-text', l.has.video && 'i-lucide-play-circle', l.has.task && 'i-lucide-clipboard-check', l.has.files && 'i-lucide-paperclip', l.has.live && 'i-lucide-video'
].filter(Boolean) as string[]
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

    <div class="flex flex-col gap-6 max-w-3xl w-full">
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
                {{ t('courses.progress', { done, of: c!.lessons.length }) }}
              </p>
              <UProgress
                :model-value="progress"
                size="sm"
                class="mt-2"
              />
            </div>
            <UButton
              v-if="nextLesson"
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

      <section class="flex flex-col gap-2">
        <h2 class="font-semibold text-highlighted">
          {{ t('courses.lessonsTitle') }}
        </h2>
        <ol
          v-if="c!.lessons.length"
          class="rounded-xl ring ring-default divide-y divide-default overflow-hidden"
        >
          <li
            v-for="l in c!.lessons"
            :key="l.id"
          >
            <component
              :is="c!.access.learn ? resolveComponent('NuxtLink') : 'div'"
              :to="c!.access.learn ? `/courses/${c!.slug}/${l.id}` : undefined"
              class="flex items-center gap-3 px-4 py-3"
              :class="c!.access.learn ? 'hover:bg-elevated/50' : ''"
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
              <span class="flex-1 min-w-0 font-medium text-highlighted truncate">{{ l.title }}</span>
              <span class="flex items-center gap-1.5 text-muted">
                <UIcon
                  v-for="i in icons(l)"
                  :key="i"
                  :name="i"
                  class="size-4"
                />
              </span>
              <UIcon
                v-if="!c!.access.learn"
                name="i-lucide-lock"
                class="size-4 text-dimmed"
              />
            </component>
          </li>
        </ol>
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
