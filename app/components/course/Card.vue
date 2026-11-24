<script setup lang="ts">
/** A course on a list: its title and teacher, what it is for, how many lessons, and how far I am. */
export interface CourseCard {
  id: string
  slug: string
  title: string
  summary: string | null
  exam: string | null
  level: string | null
  visibility: string
  published: boolean
  teacher: { name: string, avatarUrl: string | null } | null
  lessons: number
  learners: number
  done?: number
}
const props = defineProps<{ course: CourseCard, to: string, manage?: boolean }>()
const { t } = useI18n()
const progress = computed(() => (props.course.done != null && props.course.lessons ? Math.round(props.course.done / props.course.lessons * 100) : null))
</script>

<template>
  <NuxtLink
    :to="to"
    class="block rounded-xl ring ring-default bg-default p-4 hover:ring-primary/50 transition"
    data-testid="course-card"
  >
    <div class="flex flex-wrap items-center gap-1.5 mb-2">
      <UBadge
        v-if="course.exam"
        :label="examLabel(course.exam)"
        color="primary"
        variant="subtle"
        size="sm"
      />
      <UBadge
        v-if="course.level"
        :label="course.level"
        color="neutral"
        variant="subtle"
        size="sm"
      />
      <UBadge
        v-if="manage"
        :label="course.visibility === 'PUBLIC' ? t('courses.public') : t('courses.private')"
        :icon="course.visibility === 'PUBLIC' ? 'i-lucide-globe' : 'i-lucide-lock'"
        color="neutral"
        variant="outline"
        size="sm"
      />
      <UBadge
        v-if="manage && !course.published"
        :label="t('courses.draft')"
        color="warning"
        variant="subtle"
        size="sm"
      />
    </div>
    <p class="font-semibold text-highlighted line-clamp-2">
      {{ course.title }}
    </p>
    <p
      v-if="course.summary"
      class="text-sm text-muted mt-1 line-clamp-2"
    >
      {{ course.summary }}
    </p>
    <div class="flex items-center gap-2 mt-3 text-xs text-muted">
      <UAvatar
        v-if="course.teacher && !manage"
        :src="course.teacher.avatarUrl ?? undefined"
        :alt="course.teacher.name"
        size="2xs"
      />
      <span
        v-if="course.teacher && !manage"
        class="truncate"
      >{{ course.teacher.name }} ·</span>
      <span>{{ t('courses.lessons', { n: course.lessons }, course.lessons) }}</span>
      <span v-if="manage">· {{ t('courses.learners', { n: course.learners }, course.learners) }}</span>
    </div>
    <UProgress
      v-if="progress != null"
      :model-value="progress"
      size="xs"
      class="mt-3"
    />
  </NuxtLink>
</template>
