<script setup lang="ts">
import type { CourseDetailDto } from '~/types/models'
import { LESSON_TYPE_META } from '~/types/exam'

const route = useRoute()
const toast = useToast()
const { isPremium } = useMe()
const id = route.params.id as string

const { data: course, refresh } = await useFetch<CourseDetailDto>(`/api/courses/${id}`)
if (!course.value) throw createError({ statusCode: 404, statusMessage: 'Course not found' })

const enrolled = computed(() => !!course.value?.enrollment)
const completed = computed(() => new Set(course.value?.completedLessonIds ?? []))
const locked = computed(() => !!course.value?.course.isPremium && !isPremium.value && !enrolled.value)

const flatLessons = computed(() =>
  (course.value?.modules ?? []).flatMap(m => m.lessons))
const firstLessonId = computed(() => flatLessons.value[0]?.id)
const resumeLessonId = computed(() =>
  course.value?.enrollment?.lastLessonId
  ?? flatLessons.value.find(l => !completed.value.has(l.id))?.id
  ?? firstLessonId.value)

useSeoMeta({
  title: () => course.value?.course.title ?? 'Course',
  description: () => course.value?.course.description ?? 'Course details'
})

const enrolling = ref(false)
async function enroll() {
  enrolling.value = true
  try {
    await $fetch(`/api/courses/${id}/enroll`, { method: 'POST' })
    await refresh()
    toast.add({ title: 'Enrolled', description: 'You can now access all lessons.', color: 'success' })
  } catch (e) {
    toast.add({ title: (e as { data?: { message?: string } })?.data?.message ?? 'Failed to enroll', color: 'error' })
  } finally {
    enrolling.value = false
  }
}

function canOpen(lessonPreview: boolean) {
  return enrolled.value || lessonPreview
}
</script>

<template>
  <UContainer
    v-if="course"
    class="py-8 space-y-8"
  >
    <UButton
      to="/courses"
      variant="link"
      color="neutral"
      icon="i-lucide-arrow-left"
      label="All courses"
      class="-ml-2"
    />

    <!-- Header -->
    <div class="flex flex-col lg:flex-row gap-6 lg:items-start">
      <div class="flex-1 space-y-3">
        <div class="flex items-center gap-2 flex-wrap">
          <h1 class="text-2xl font-bold">
            {{ course.course.title }}
          </h1>
          <UBadge
            v-if="course.course.isPremium"
            color="primary"
            variant="subtle"
            icon="i-lucide-sparkles"
            label="Premium"
            size="sm"
          />
        </div>
        <p class="text-muted">
          {{ course.course.description || 'Structured course' }}
        </p>
        <div class="flex flex-wrap gap-2">
          <UBadge
            v-if="course.course.level"
            color="neutral"
            variant="subtle"
            :label="course.course.level"
          />
          <UBadge
            v-if="course.course.category"
            color="neutral"
            variant="subtle"
            :label="course.course.category"
          />
          <UBadge
            color="neutral"
            variant="subtle"
            :label="`${course.lessonCount} lessons`"
            icon="i-lucide-book-open"
          />
          <UBadge
            v-if="course.course.estimatedMinutes"
            color="neutral"
            variant="subtle"
            :label="`~${course.course.estimatedMinutes} min`"
            icon="i-lucide-clock"
          />
        </div>
      </div>

      <UCard class="w-full lg:w-80 shrink-0">
        <div
          v-if="enrolled"
          class="space-y-3"
        >
          <div class="space-y-1">
            <div class="flex justify-between text-sm">
              <span class="text-muted">Progress</span>
              <span class="font-medium">{{ course.progress }}%</span>
            </div>
            <UProgress :model-value="course.progress" />
          </div>
          <UButton
            v-if="resumeLessonId"
            :to="`/courses/${id}/lessons/${resumeLessonId}`"
            block
            :label="course.progress > 0 ? 'Resume course' : 'Start course'"
            trailing-icon="i-lucide-arrow-right"
          />
          <UBadge
            v-if="course.enrollment?.status === 'completed'"
            color="success"
            variant="subtle"
            icon="i-lucide-check-check"
            label="Completed"
            class="w-full justify-center"
          />
        </div>

        <div
          v-else
          class="space-y-3"
        >
          <p class="text-sm text-muted">
            Enroll to unlock every lesson and track your progress.
          </p>
          <UButton
            v-if="locked"
            to="/upgrade"
            block
            color="primary"
            variant="subtle"
            icon="i-lucide-lock"
            label="Unlock with Premium"
          />
          <UButton
            v-else
            block
            :loading="enrolling"
            label="Enroll for free"
            icon="i-lucide-graduation-cap"
            @click="enroll"
          />
          <UButton
            v-if="firstLessonId && flatLessons.some(l => l.isPreview)"
            :to="`/courses/${id}/lessons/${flatLessons.find(l => l.isPreview)!.id}`"
            block
            variant="subtle"
            color="neutral"
            label="Preview a lesson"
            icon="i-lucide-eye"
          />
        </div>
      </UCard>
    </div>

    <!-- Curriculum -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">
        Curriculum
      </h2>

      <UAlert
        v-if="!course.modules.length"
        icon="i-lucide-inbox"
        color="neutral"
        variant="subtle"
        title="This course has no lessons yet"
      />

      <div
        v-for="(m, mi) in course.modules"
        :key="m.id"
        class="space-y-2"
      >
        <div class="flex items-baseline gap-2">
          <h3 class="font-semibold">
            {{ mi + 1 }}. {{ m.title }}
          </h3>
          <span class="text-xs text-muted">{{ m.lessons.length }} lessons</span>
        </div>
        <p
          v-if="m.summary"
          class="text-sm text-muted"
        >
          {{ m.summary }}
        </p>

        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <div class="divide-y divide-default">
            <component
              :is="canOpen(l.isPreview) ? 'NuxtLink' : 'div'"
              v-for="l in m.lessons"
              :key="l.id"
              :to="canOpen(l.isPreview) ? `/courses/${id}/lessons/${l.id}` : undefined"
              class="flex items-center gap-3 p-3"
              :class="canOpen(l.isPreview) ? 'hover:bg-elevated/50 transition-colors' : ''"
            >
              <UIcon
                :name="completed.has(l.id) ? 'i-lucide-check-circle-2' : LESSON_TYPE_META[l.type].icon"
                class="size-5 shrink-0"
                :class="completed.has(l.id) ? 'text-success' : 'text-muted'"
              />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">
                  {{ l.title }}
                </p>
                <p class="text-xs text-muted">
                  {{ LESSON_TYPE_META[l.type].label }} · {{ l.durationMinutes }} min
                </p>
              </div>
              <UBadge
                v-if="l.isPreview && !enrolled"
                color="info"
                variant="subtle"
                size="sm"
                label="Preview"
              />
              <UIcon
                v-else-if="!canOpen(l.isPreview)"
                name="i-lucide-lock"
                class="size-4 text-muted shrink-0"
              />
              <UIcon
                v-else
                name="i-lucide-chevron-right"
                class="size-4 text-muted shrink-0"
              />
            </component>
          </div>
        </UCard>
      </div>
    </section>
  </UContainer>
</template>
