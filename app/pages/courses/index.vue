<script setup lang="ts">
import type { CourseListItemDto, MyCourseDto, Paginated } from '~/types/models'

const { isPremium } = useMe()
const page = ref(1)
const { data } = await useFetch<Paginated<CourseListItemDto>>('/api/courses', { query: { page } })
const { data: mine } = await useFetch<MyCourseDto[]>('/api/me/courses')

const courses = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const pageSize = computed(() => data.value?.pageSize ?? 20)
const inProgress = computed(() => (mine.value ?? []).filter(c => c.status !== 'completed' && c.progress > 0))

useSeoMeta({
  title: 'Courses',
  description: 'Learn with structured video and reading courses, then practise with mock exams.'
})

function locked(c: CourseListItemDto) {
  return c.isPremium && !isPremium.value
}
</script>

<template>
  <UContainer class="py-8 space-y-8">
    <div>
      <h1 class="text-2xl font-bold">
        Courses
      </h1>
      <p class="text-muted">
        Structured lessons to build the skills you need for the exam.
      </p>
    </div>

    <!-- Continue learning -->
    <section
      v-if="inProgress.length"
      class="space-y-3"
    >
      <h2 class="text-lg font-semibold">
        Continue learning
      </h2>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <UCard
          v-for="c in inProgress"
          :key="c.enrollmentId"
        >
          <h3 class="font-semibold truncate">
            {{ c.title }}
          </h3>
          <div class="mt-3 space-y-1">
            <div class="flex justify-between text-xs text-muted">
              <span>{{ c.completedCount }}/{{ c.lessonCount }} lessons</span>
              <span>{{ c.progress }}%</span>
            </div>
            <UProgress
              :model-value="c.progress"
              size="sm"
            />
          </div>
          <template #footer>
            <UButton
              :to="c.lastLessonId
                ? `/courses/${c.id}/lessons/${c.lastLessonId}`
                : `/courses/${c.id}`"
              block
              label="Resume"
              trailing-icon="i-lucide-arrow-right"
            />
          </template>
        </UCard>
      </div>
    </section>

    <!-- Catalog -->
    <section class="space-y-3">
      <h2
        v-if="inProgress.length"
        class="text-lg font-semibold"
      >
        All courses
      </h2>
      <div
        v-if="courses.length"
        class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <UCard
          v-for="c in courses"
          :key="c.id"
          class="flex flex-col"
        >
          <div class="flex items-start justify-between gap-2">
            <h3 class="font-semibold">
              {{ c.title }}
            </h3>
            <UBadge
              v-if="c.isPremium"
              color="primary"
              variant="subtle"
              icon="i-lucide-sparkles"
              label="Premium"
              size="sm"
            />
          </div>
          <p class="text-sm text-muted mt-1 line-clamp-2">
            {{ c.description || 'Structured course' }}
          </p>
          <div class="flex flex-wrap gap-2 mt-3">
            <UBadge
              v-if="c.level"
              color="neutral"
              variant="subtle"
              :label="c.level"
              size="sm"
            />
            <UBadge
              v-if="c.category"
              color="neutral"
              variant="subtle"
              :label="c.category"
              size="sm"
            />
            <UBadge
              color="neutral"
              variant="subtle"
              :label="`${c.lessonCount} lessons`"
              size="sm"
              icon="i-lucide-book-open"
            />
          </div>
          <template #footer>
            <UButton
              v-if="locked(c)"
              to="/upgrade"
              block
              color="primary"
              variant="subtle"
              icon="i-lucide-lock"
              label="Unlock with Premium"
            />
            <UButton
              v-else
              :to="`/courses/${c.id}`"
              block
              :label="c.enrolled ? 'Continue' : 'View course'"
              trailing-icon="i-lucide-arrow-right"
            />
          </template>
        </UCard>
      </div>

      <UAlert
        v-else
        icon="i-lucide-inbox"
        color="neutral"
        variant="subtle"
        title="No courses available yet"
        description="Check back soon."
      />
    </section>

    <div
      v-if="total > pageSize"
      class="flex justify-center"
    >
      <UPagination
        v-model:page="page"
        :total="total"
        :items-per-page="pageSize"
      />
    </div>
  </UContainer>
</template>
