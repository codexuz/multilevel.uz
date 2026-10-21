<script setup lang="ts">
import type { ResultView } from '~/components/result/Review.vue'

const { t } = useI18n()

/** A saved attempt: its score, or that it is with an examiner, and the examiner's word once marked. */
const route = useRoute()
const id = String(route.params.id)
const { data, error, refresh } = await useFetch<ResultView & Record<string, any>>(`/api/attempts/${id}`)
useSeoMeta({ title: () => (data.value?.test?.title ? `${t('review.result')} — ${data.value.test.title}` : t('review.result')), robots: 'noindex' })

// Marked while the page is open: the user-events plugin raises this.
const nuxtApp = useNuxtApp()
const off = nuxtApp.hook('ml:graded' as any, (attemptId: string) => {
  if (attemptId === id) refresh()
})
onBeforeUnmount(() => off?.())
</script>

<template>
  <AppPage
    :title="t('review.result')"
    icon="i-lucide-award"
  >
    <template #actions>
      <UButton
        to="/results"
        :label="t('nav.results')"
        icon="i-lucide-chart-column"
        color="neutral"
        variant="ghost"
      />
    </template>
    <UEmpty
      v-if="error"
      icon="i-lucide-file-question"
      :title="t('results.notFound')"
      :description="t('results.notFoundText')"
      :actions="[{ label: t('nav.results'), to: '/results' }]"
    />
    <ResultSummary
      v-else-if="data"
      :view="data"
      :review-to="`/results/${id}/review`"
    >
      <UAlert
        v-if="data.liveMockId"
        icon="i-lucide-trophy"
        color="primary"
        variant="subtle"
        :title="t('results.liveCounted')"
        :description="data.skill === 'LISTENING' || data.skill === 'READING' ? t('results.liveRanked') : t('results.liveNotRanked')"
        :actions="[{ label: t('live.leaderboard'), to: `/live?mock=${data.liveMockId}`, color: 'primary', variant: 'solid' }]"
      />
      <UCard v-if="data.status === 'GRADED' && data.feedback">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon
              name="i-lucide-message-square-text"
              class="text-warning"
            />
            <span class="font-semibold">Examiner's feedback</span>
            <span
              v-if="data.examiner"
              class="text-sm text-muted ms-auto"
            >{{ data.examiner.name }}</span>
          </div>
        </template>
        <p class="whitespace-pre-wrap leading-7">
          {{ data.feedback }}
        </p>
      </UCard>
      <AiWritingFeedback
        v-if="data.skill === 'WRITING' || data.skill === 'SPEAKING'"
        :skill="data.skill"
        :attempt-id="id"
      />
    </ResultSummary>
  </AppPage>
</template>
