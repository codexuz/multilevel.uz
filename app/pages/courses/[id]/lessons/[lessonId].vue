<script setup lang="ts">
import type { CourseDetailDto, LessonDto } from '~/types/models'
import { LESSON_TYPE_META } from '~/types/exam'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { refresh: refreshMe } = useMe()

const courseId = computed(() => route.params.id as string)
const lessonId = computed(() => route.params.lessonId as string)

// Sidebar tree + current lesson content, refetched when the lessonId changes.
const { data: course } = await useFetch<CourseDetailDto>(() => `/api/courses/${courseId.value}`)
const { data: lesson, refresh: refreshLesson } = await useFetch<LessonDto>(
  () => `/api/courses/${courseId.value}/lessons/${lessonId.value}`
)
if (!lesson.value) throw createError({ statusCode: 404, statusMessage: 'Lesson not found' })

const completedIds = ref(new Set(course.value?.completedLessonIds ?? []))
watchEffect(() => {
  if (lesson.value?.completed) completedIds.value.add(lesson.value.id)
})

const flatLessons = computed(() => (course.value?.modules ?? []).flatMap(m => m.lessons))
const currentIndex = computed(() => flatLessons.value.findIndex(l => l.id === lessonId.value))
const prevLesson = computed(() => currentIndex.value > 0 ? flatLessons.value[currentIndex.value - 1] : null)
const nextLesson = computed(() =>
  currentIndex.value >= 0 && currentIndex.value < flatLessons.value.length - 1
    ? flatLessons.value[currentIndex.value + 1]
    : null)

const progress = computed(() => {
  const total = flatLessons.value.length
  if (!total) return 0
  const done = flatLessons.value.filter(l => completedIds.value.has(l.id)).length
  return Math.round((done / total) * 100)
})

useSeoMeta({ title: () => lesson.value?.title ?? 'Lesson' })

// Build an embeddable video URL for common providers.
const embedUrl = computed(() => {
  const url = lesson.value?.videoUrl
  if (!url) return null
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  // Vimeo: normal, channel, and player URLs, plus optional privacy hash for
  // unlisted videos (vimeo.com/123456789/abcdef123 -> ?h=abcdef123).
  const vimeo = url.match(/vimeo\.com\/(?:.*\/)?(\d+)(?:\/([\w]+))?/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}${vimeo[2] ? `?h=${vimeo[2]}` : ''}`
  return null
})
// Anything the server didn't hand back as a YouTube/Vimeo embed is a direct
// file — served through the gated /video endpoint, which has no file extension.
const isDirectVideo = computed(() => !!lesson.value?.videoUrl && !embedUrl.value)

// Turn bare URLs in the lesson HTML into links, and make every link open in a
// new window. Splits on tags so we never linkify inside attributes or existing
// anchors (works during SSR — no DOM APIs required).
function linkifyText(text: string) {
  return text.replace(/(https?:\/\/[^\s<]+)/g, (match) => {
    const trail = match.match(/[.,;:!?)\]]+$/)?.[0] ?? ''
    const url = trail ? match.slice(0, -trail.length) : match
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${trail}`
  })
}
const renderedContent = computed(() => {
  const html = lesson.value?.content
  if (!html) return ''
  let insideAnchor = 0
  return html.split(/(<[^>]+>)/).map((seg) => {
    if (seg.startsWith('<')) {
      const tag = seg.toLowerCase()
      if (tag.startsWith('<a ') || tag === '<a>') {
        insideAnchor++
        return /target=/i.test(seg)
          ? seg
          : seg.replace(/<a\b/i, '<a target="_blank" rel="noopener noreferrer"')
      }
      if (tag.startsWith('</a')) {
        if (insideAnchor > 0) insideAnchor--
        return seg
      }
      return seg
    }
    return insideAnchor > 0 ? seg : linkifyText(seg)
  }).join('')
})

const saving = ref(false)
async function toggleComplete() {
  if (!lesson.value) return
  const next = !lesson.value.completed
  saving.value = true
  try {
    const res = await $fetch<{ progress: number, courseCompleted: boolean, award: unknown }>(
      `/api/courses/${courseId.value}/lessons/${lessonId.value}/complete`,
      { method: 'POST', body: { completed: next } }
    )
    lesson.value.completed = next
    if (next) completedIds.value.add(lesson.value.id)
    else completedIds.value.delete(lesson.value.id)
    if (next && res.award) {
      await refreshMe()
      toast.add({ title: '+10 points', description: 'Lesson completed!', color: 'success', icon: 'i-lucide-star' })
    }
    if (res.courseCompleted && next) {
      toast.add({ title: 'Course complete 🎉', description: 'You finished every lesson.', color: 'success' })
    }
  } catch (e) {
    toast.add({ title: (e as { data?: { message?: string } })?.data?.message ?? 'Failed', color: 'error' })
  } finally {
    saving.value = false
  }
}

async function goNext() {
  // Auto-complete before advancing for a smoother flow.
  if (lesson.value && !lesson.value.completed && lesson.value.enrolled) await toggleComplete()
  if (nextLesson.value) router.push(`/courses/${courseId.value}/lessons/${nextLesson.value.id}`)
}

watch(lessonId, () => refreshLesson())
</script>

<template>
  <UContainer
    v-if="lesson"
    class="py-6"
  >
    <div class="flex flex-col lg:flex-row gap-6">
      <!-- Sidebar curriculum -->
      <aside class="lg:w-72 shrink-0 order-2 lg:order-1">
        <div class="lg:sticky lg:top-20 space-y-3">
          <UButton
            :to="`/courses/${courseId}`"
            variant="link"
            color="neutral"
            icon="i-lucide-arrow-left"
            :label="course?.course.title || 'Course'"
            class="-ml-2 max-w-full"
            :ui="{ label: 'truncate' }"
          />
          <div class="space-y-1 px-1">
            <div class="flex justify-between text-xs text-muted">
              <span>Progress</span><span>{{ progress }}%</span>
            </div>
            <UProgress
              :model-value="progress"
              size="sm"
            />
          </div>

          <div class="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div
              v-for="m in course?.modules ?? []"
              :key="m.id"
            >
              <p class="text-xs font-semibold uppercase text-muted px-1 mb-1">
                {{ m.title }}
              </p>
              <NuxtLink
                v-for="l in m.lessons"
                :key="l.id"
                :to="`/courses/${courseId}/lessons/${l.id}`"
                class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
                :class="l.id === lessonId ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-elevated/60'"
              >
                <UIcon
                  :name="completedIds.has(l.id) ? 'i-lucide-check-circle-2' : LESSON_TYPE_META[l.type].icon"
                  class="size-4 shrink-0"
                  :class="completedIds.has(l.id) ? 'text-success' : 'text-muted'"
                />
                <span class="truncate">{{ l.title }}</span>
              </NuxtLink>
            </div>
          </div>
        </div>
      </aside>

      <!-- Lesson content -->
      <main class="flex-1 min-w-0 order-1 lg:order-2 space-y-6">
        <div>
          <div class="flex items-center gap-2 text-xs text-muted mb-1">
            <UIcon
              :name="LESSON_TYPE_META[lesson.type].icon"
              class="size-4"
            />
            <span>{{ LESSON_TYPE_META[lesson.type].label }} · {{ lesson.durationMinutes }} min</span>
          </div>
          <h1 class="text-2xl font-bold">
            {{ lesson.title }}
          </h1>
        </div>

        <!-- Video -->
        <div
          v-if="embedUrl"
          class="aspect-video w-full rounded-lg overflow-hidden bg-black"
        >
          <iframe
            :src="embedUrl"
            class="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          />
        </div>
        <video
          v-else-if="isDirectVideo"
          :src="lesson.videoUrl!"
          controls
          controlslist="nodownload noplaybackrate"
          disablepictureinpicture
          class="w-full rounded-lg bg-black"
          @contextmenu.prevent
        />

        <!-- Article body -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div
          v-if="lesson.content"
          class="prose prose-sm dark:prose-invert max-w-none"
          v-html="renderedContent"
        />

        <UAlert
          v-if="!lesson.content && !lesson.videoUrl"
          icon="i-lucide-file-question"
          color="neutral"
          variant="subtle"
          title="This lesson has no content yet."
        />

        <!-- Attachments -->
        <div
          v-if="lesson.attachments?.length"
          class="space-y-2"
        >
          <h3 class="text-sm font-semibold">
            Resources
          </h3>
          <UButton
            v-for="(a, i) in lesson.attachments"
            :key="i"
            :to="a.url"
            target="_blank"
            variant="subtle"
            color="neutral"
            icon="i-lucide-paperclip"
            :label="a.label"
            class="mr-2 mb-2"
          />
        </div>

        <USeparator />

        <!-- Footer actions -->
        <div class="flex items-center justify-between gap-3">
          <UButton
            v-if="prevLesson"
            :to="`/courses/${courseId}/lessons/${prevLesson.id}`"
            variant="ghost"
            color="neutral"
            icon="i-lucide-arrow-left"
            label="Previous"
          />
          <div v-else />

          <div class="flex items-center gap-2">
            <UButton
              v-if="lesson.enrolled"
              :color="lesson.completed ? 'success' : 'neutral'"
              :variant="lesson.completed ? 'subtle' : 'outline'"
              :icon="lesson.completed ? 'i-lucide-check-check' : 'i-lucide-circle'"
              :label="lesson.completed ? 'Completed' : 'Mark complete'"
              :loading="saving"
              @click="toggleComplete"
            />
            <UButton
              v-if="nextLesson"
              label="Next"
              trailing-icon="i-lucide-arrow-right"
              @click="goNext"
            />
          </div>
        </div>

        <UAlert
          v-if="!lesson.enrolled"
          icon="i-lucide-info"
          color="info"
          variant="subtle"
          title="Preview lesson"
          description="Enroll in the course to track progress and unlock all lessons."
        >
          <template #actions>
            <UButton
              :to="`/courses/${courseId}`"
              size="sm"
              color="info"
              label="View course"
            />
          </template>
        </UAlert>
      </main>
    </div>
  </UContainer>
</template>
