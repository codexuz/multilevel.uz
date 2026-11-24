<script setup lang="ts">
import type { CourseCard } from '~/components/course/Card.vue'

/**
 * Courses: the public catalogue of teachers' courses (anyone, for search engines too); signed in,
 * the courses I take (my teachers' private ones, and public ones I enrolled in) above it, and the
 * way to my own as a teacher.
 */
definePageMeta({ guestLayout: true })
const { t } = useI18n()
const { loggedIn, me } = useMe()
useSeoMeta({
  title: () => t('courses.seoTitle'),
  description: () => t('courses.seoText'),
  ogTitle: () => t('courses.seoTitle'),
  ogDescription: () => t('courses.seoText')
})

const exam = ref<'ALL' | 'IELTS' | 'MULTILEVEL'>('ALL')
const { data, status } = await useFetch<{ courses: CourseCard[] }>('/api/courses', {
  query: { exam: computed(() => (exam.value === 'ALL' ? undefined : exam.value)) },
  default: () => ({ courses: [] })
})
const { data: mine } = await useFetch<{ learning: CourseCard[], teaching: CourseCard[] }>('/api/me/courses', {
  default: () => ({ learning: [], teaching: [] }),
  immediate: loggedIn.value
})
const exams = computed(() => [
  { label: t('courses.allExams'), value: 'ALL' },
  { label: 'IELTS', value: 'IELTS' },
  { label: 'Multilevel', value: 'MULTILEVEL' }
])
const isTeacher = computed(() => !!me.value && (me.value.role === 'teacher' || me.value.role === 'center_owner' || me.value.role === 'admin' || !!me.value.teaches))
</script>

<template>
  <AppPage
    :title="t('nav.courses')"
    icon="i-lucide-graduation-cap"
  >
    <template #actions>
      <UButton
        v-if="isTeacher"
        to="/teacher/courses"
        :label="t('courses.myTeaching')"
        icon="i-lucide-pencil-ruler"
        color="neutral"
        variant="outline"
      />
    </template>

    <div class="flex flex-col gap-8 max-w-5xl w-full">
      <section
        v-if="mine.learning.length"
        class="flex flex-col gap-3"
      >
        <h2 class="font-semibold text-highlighted">
          {{ t('courses.mine') }}
        </h2>
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <CourseCard
            v-for="c in mine.learning"
            :key="c.id"
            :course="c"
            :to="`/courses/${c.slug}`"
          />
        </div>
      </section>

      <section class="flex flex-col gap-3">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold text-highlighted">
              {{ t('courses.catalogue') }}
            </h1>
            <p class="text-muted mt-1">
              {{ t('courses.catalogueText') }}
            </p>
          </div>
          <UTabs
            v-model="exam"
            :items="exams"
            :content="false"
            size="sm"
          />
        </div>
        <div
          v-if="status === 'pending' && !data.courses.length"
          class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          <USkeleton
            v-for="i in 3"
            :key="i"
            class="h-36 rounded-xl"
          />
        </div>
        <div
          v-else-if="data.courses.length"
          class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          <CourseCard
            v-for="c in data.courses"
            :key="c.id"
            :course="c"
            :to="`/courses/${c.slug}`"
          />
        </div>
        <UEmpty
          v-else
          icon="i-lucide-graduation-cap"
          :title="t('courses.noneYet')"
          :description="t('courses.noneYetText')"
          :actions="isTeacher ? [{ label: t('courses.make'), to: '/teacher/courses', icon: 'i-lucide-plus' }] : undefined"
        />
      </section>
    </div>
  </AppPage>
</template>
