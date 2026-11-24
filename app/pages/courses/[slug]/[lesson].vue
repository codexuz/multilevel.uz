<script setup lang="ts">
import type { LiveLesson } from '~/components/online/Row.vue'

/**
 * A course lesson: its video, its text, its files, the test to do (done once handed in), and its
 * online class on Google Meet; Mark as done, and the lessons before and after it.
 */
interface LessonView {
  id: string
  title: string
  body: string | null
  videoUrl: string | null
  files: { name: string, url: string, size: number | null }[]
  task: { test: string, skill: string, partNumber: number | null, to: string, done: boolean } | null
  live: LiveLesson | null
  done: boolean
  course: { id: string, slug: string, title: string, teaches: boolean }
  position: number
  of: number
  prev: { id: string, title: string } | null
  next: { id: string, title: string } | null
}

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const slug = String(route.params.slug)
const { data: l, error, refresh } = await useFetch<LessonView>(() => `/api/course-lessons/${route.params.lesson}`)
if (error.value?.statusCode === 403) await navigateTo(`/courses/${slug}`)
else if (error.value || !l.value) throw createError({ statusCode: 404, statusMessage: t('courses.lessonNotFound'), fatal: true })
useSeoMeta({ title: () => (l.value ? `${l.value.title} · ${l.value.course.title}` : t('nav.courses')), robots: 'noindex' })

const embed = computed(() => videoEmbed(l.value?.videoUrl))
const sizeText = (n: number | null) => (n == null ? '' : n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
const taskName = computed(() => (l.value?.task ? `${skillLabel(l.value.task.skill)}${l.value.task.partNumber ? ` · ${partName(l.value.task.skill, l.value.task.partNumber)}` : ''}` : ''))

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
</script>

<template>
  <AppPage
    v-if="l"
    :title="l.course.title"
    icon="i-lucide-graduation-cap"
    :back="`/courses/${l.course.slug}`"
  >
    <article class="flex flex-col gap-5 max-w-3xl w-full">
      <div>
        <p class="text-sm text-muted">
          {{ t('courses.lessonOf', { n: l.position, of: l.of }) }}
        </p>
        <h1 class="text-2xl sm:text-3xl font-bold text-highlighted">
          {{ l.title }}
        </h1>
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

      <div class="flex flex-wrap items-center gap-2 border-t border-default pt-4">
        <UButton
          v-if="!l.course.teaches"
          :label="l.done ? t('courses.doneMarked') : t('courses.markDone')"
          :icon="l.done ? 'i-lucide-circle-check' : 'i-lucide-check'"
          :color="l.done ? 'success' : 'primary'"
          :variant="l.done ? 'soft' : 'solid'"
          :loading="busy"
          data-testid="mark-done"
          @click="toggleDone"
        />
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
          :to="`/courses/${l.course.slug}/${l.next.id}`"
          :label="t('courses.next')"
          trailing-icon="i-lucide-arrow-right"
          color="neutral"
          variant="outline"
        />
      </div>
    </article>
  </AppPage>
</template>
