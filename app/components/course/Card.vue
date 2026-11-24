<script setup lang="ts">
/** A course on a list: its cover, title and teacher, what it is for, how many lessons, and how far I am. */
export interface CourseCard {
  id: string
  slug: string
  title: string
  summary: string | null
  coverUrl?: string | null
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
const meta = computed(() => [
  props.manage ? null : props.course.teacher?.name,
  t('courses.lessons', { n: props.course.lessons }, props.course.lessons),
  props.manage ? t('courses.learners', { n: props.course.learners }, props.course.learners) : null
].filter(Boolean).join(' · '))
const progress = computed(() => (props.course.done != null && props.course.lessons ? Math.round(props.course.done / props.course.lessons * 100) : null))
</script>

<template>
  <NuxtLink
    :to="to"
    class="group flex flex-col rounded-xl ring ring-default bg-default overflow-hidden hover:ring-accented hover:shadow-overlay transition-shadow duration-200 focus-visible:outline-2 focus-visible:outline-primary"
    data-testid="course-card"
  >
    <div class="aspect-video bg-elevated overflow-hidden">
      <img
        v-if="course.coverUrl"
        :src="course.coverUrl"
        alt=""
        loading="lazy"
        class="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
      >
      <div
        v-else
        class="size-full grid place-items-center bg-primary/5 text-primary/40"
      >
        <UIcon
          name="i-lucide-graduation-cap"
          class="size-10"
        />
      </div>
    </div>
    <div class="flex-1 flex flex-col p-4">
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
      <div class="flex items-center gap-2 mt-auto pt-3 text-xs text-muted">
        <UAvatar
          v-if="course.teacher && !manage"
          :src="course.teacher.avatarUrl ?? undefined"
          :alt="course.teacher.name"
          size="2xs"
        />
        <span class="truncate">{{ meta }}</span>
      </div>
      <UProgress
        v-if="progress != null"
        :model-value="progress"
        size="xs"
        class="mt-3"
      />
    </div>
  </NuxtLink>
</template>
