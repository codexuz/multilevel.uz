<script setup lang="ts">
definePageMeta({ middleware: 'teacher', layout: 'teacher' })
const { t } = useI18n()
useSeoMeta({ title: () => t('panel.results'), robots: 'noindex' })

interface ResultsPayload {
  examResults: Array<{
    id: string
    studentName: string
    avatarUrl: string | null
    testTitle: string
    skill: string
    exam: string
    score: number | null
    band: number | null
    cefrLevel: string | null
    status: string
    submittedAt: string
    to: string
  }>
  exerciseResults: Array<{
    id: string
    studentName: string
    avatarUrl: string | null
    courseTitle: string
    lessonTitle: string
    exerciseTitle: string
    score: number
    earnedPoints: number
    totalPoints: number
    passed: boolean
    submittedAt: string
  }>
}

const tab = ref<'exams' | 'exercises'>('exams')
const search = ref('')
const { data } = await useFetch<ResultsPayload>('/api/teacher/results', {
  default: () => ({ examResults: [], exerciseResults: [] })
})

const tabs = computed(() => [
  { label: t('tp.examTab', { n: data.value.examResults.length }), value: 'exams', icon: 'i-lucide-clipboard-check' },
  { label: t('tp.quizTab', { n: data.value.exerciseResults.length }), value: 'exercises', icon: 'i-lucide-book-open-check' }
])

const filteredExams = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return data.value.examResults
  return data.value.examResults.filter(r => r.studentName.toLowerCase().includes(q) || r.testTitle.toLowerCase().includes(q))
})

const filteredExercises = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return data.value.exerciseResults
  return data.value.exerciseResults.filter(r =>
    r.studentName.toLowerCase().includes(q)
    || r.courseTitle.toLowerCase().includes(q)
    || r.exerciseTitle.toLowerCase().includes(q)
  )
})
</script>

<template>
  <AppPage
    :title="t('panel.results')"
    icon="i-lucide-bar-chart-2"
  >
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <UTabs
          v-model="tab"
          :items="tabs"
          :content="false"
        />
        <UInput
          v-model="search"
          icon="i-lucide-search"
          :placeholder="t('tp.filterResults')"
          class="w-full sm:w-72"
        />
      </div>

      <UCard
        v-if="tab === 'exams'"
        :ui="{ body: 'p-0' }"
      >
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-default text-left text-xs font-semibold text-muted">
                <th class="px-4 py-3">
                  {{ t('builder.learner') }}
                </th>
                <th class="px-4 py-3">
                  {{ t('tp.testSkill') }}
                </th>
                <th class="px-4 py-3">
                  {{ t('courses.exam') }}
                </th>
                <th class="px-4 py-3">
                  {{ t('tp.score') }}
                </th>
                <th class="px-4 py-3">
                  {{ t('tp.status') }}
                </th>
                <th class="px-4 py-3">
                  {{ t('tp.date') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default/60">
              <tr
                v-for="r in filteredExams"
                :key="r.id"
                class="hover:bg-elevated/40"
              >
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <UAvatar
                      :src="r.avatarUrl ?? undefined"
                      :alt="r.studentName"
                      size="xs"
                    />
                    <span class="font-medium text-highlighted">{{ r.studentName }}</span>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <NuxtLink
                    :to="r.to"
                    class="text-highlighted hover:text-primary font-medium"
                  >
                    {{ r.testTitle }}
                  </NuxtLink>
                  <span class="text-xs text-muted ms-1.5">· {{ r.skill }}</span>
                </td>
                <td class="px-4 py-3">
                  <UBadge
                    :label="r.exam === 'IELTS' ? 'IELTS' : (r.cefrLevel || 'CEFR')"
                    :color="r.exam === 'IELTS' ? 'error' : 'primary'"
                    variant="subtle"
                    size="xs"
                  />
                </td>
                <td class="px-4 py-3 font-semibold tabular-nums">
                  {{ r.exam === 'IELTS' && r.band != null ? t('tp.band', { band: r.band.toFixed(1) }) : r.score != null ? `${r.score}/75` : '—' }}
                </td>
                <td class="px-4 py-3">
                  <UBadge
                    :label="r.status"
                    :color="r.status === 'GRADED' ? 'success' : 'warning'"
                    variant="soft"
                    size="xs"
                  />
                </td>
                <td class="px-4 py-3 text-xs text-muted">
                  {{ localeDate(r.submittedAt, intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) }}
                </td>
              </tr>
              <tr v-if="!filteredExams.length">
                <td
                  colspan="6"
                  class="py-10 text-center text-muted"
                >
                  {{ t('tp.noExamResults') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <UCard
        v-else
        :ui="{ body: 'p-0' }"
      >
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-default text-left text-xs font-semibold text-muted">
                <th class="px-4 py-3">
                  {{ t('builder.learner') }}
                </th>
                <th class="px-4 py-3">
                  Course &amp; Lesson
                </th>
                <th class="px-4 py-3">
                  {{ t('builder.quiz') }}
                </th>
                <th class="px-4 py-3">
                  {{ t('tp.score') }}
                </th>
                <th class="px-4 py-3">
                  {{ t('tp.outcome') }}
                </th>
                <th class="px-4 py-3">
                  {{ t('tp.submitted') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default/60">
              <tr
                v-for="e in filteredExercises"
                :key="e.id"
                class="hover:bg-elevated/40"
              >
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <UAvatar
                      :src="e.avatarUrl ?? undefined"
                      :alt="e.studentName"
                      size="xs"
                    />
                    <span class="font-medium text-highlighted">{{ e.studentName }}</span>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <p class="font-medium text-highlighted">
                    {{ e.courseTitle }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ e.lessonTitle }}
                  </p>
                </td>
                <td class="px-4 py-3 text-toned">
                  {{ e.exerciseTitle }}
                </td>
                <td class="px-4 py-3 font-semibold tabular-nums">
                  {{ e.score }}% <span class="text-xs font-normal text-muted">({{ e.earnedPoints }}/{{ e.totalPoints }})</span>
                </td>
                <td class="px-4 py-3">
                  <UBadge
                    :label="e.passed ? t('tdash.passed') : t('tp.tryAgain')"
                    :color="e.passed ? 'success' : 'warning'"
                    variant="soft"
                    size="xs"
                  />
                </td>
                <td class="px-4 py-3 text-xs text-muted">
                  {{ localeDate(e.submittedAt, intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) }}
                </td>
              </tr>
              <tr v-if="!filteredExercises.length">
                <td
                  colspan="6"
                  class="py-10 text-center text-muted"
                >
                  {{ t('tp.noQuizResults') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </div>
  </AppPage>
</template>
