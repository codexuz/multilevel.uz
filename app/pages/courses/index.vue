<script setup lang="ts">
import type { CourseCard } from '~/components/course/Card.vue'

/**
 * Courses, in two tabs: the catalogue of teachers' public courses (anyone, for search engines too,
 * by exam), and, signed in, My courses (my teachers' private ones and public ones I enrolled in,
 * with how far I am). My courses opens first when I have any; the tab is kept in the address.
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
const route = useRoute()
const router = useRouter()
const showMine = computed(() => loggedIn.value && areaOf(me.value?.role) === 'student')
const tab = computed<'all' | 'mine'>({
  get: () => (route.query.tab === 'all' || route.query.tab === 'mine' ? route.query.tab : (showMine.value && mine.value.learning.length ? 'mine' : 'all')),
  set: v => router.replace({ query: { ...route.query, tab: v } })
})
const tabs = computed(() => [
  { label: t('courses.catalogue'), value: 'all', icon: 'i-lucide-library' },
  { label: t('courses.mine'), value: 'mine', icon: 'i-lucide-bookmark-check', badge: mine.value.learning.length || undefined }
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

    <div class="flex flex-col gap-6 max-w-6xl w-full">
      <div class="flex flex-col gap-1">
        <h1 class="text-2xl sm:text-3xl font-bold text-highlighted">
          {{ t('courses.catalogue') }}
        </h1>
        <p class="text-muted">
          {{ t('courses.catalogueText') }}
        </p>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-default">
        <UTabs
          v-if="showMine"
          v-model="tab"
          :items="tabs"
          :content="false"
          variant="link"
          class="-mb-px"
          data-testid="courses-tabs"
        />
        <UTabs
          v-if="tab === 'all'"
          v-model="exam"
          :items="exams"
          :content="false"
          size="sm"
          class="ms-auto pb-2"
        />
      </div>

      <template v-if="tab === 'mine' && showMine">
        <div
          v-if="mine.learning.length"
          class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          <CourseCard
            v-for="c in mine.learning"
            :key="c.id"
            :course="c"
            :to="`/courses/${c.slug}`"
          />
        </div>
        <UEmpty
          v-else
          icon="i-lucide-bookmark"
          :title="t('courses.mineEmpty')"
          :description="t('courses.mineEmptyText')"
          :actions="[{ label: t('courses.browse'), icon: 'i-lucide-library', onClick: () => { tab = 'all' } }]"
          variant="outline"
        />
      </template>

      <template v-else>
        <div
          v-if="status === 'pending' && !data.courses.length"
          class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          <USkeleton
            v-for="i in 3"
            :key="i"
            class="h-64 rounded-xl"
          />
        </div>
        <div
          v-else-if="data.courses.length"
          class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4"
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
      </template>
    </div>
  </AppPage>
</template>
