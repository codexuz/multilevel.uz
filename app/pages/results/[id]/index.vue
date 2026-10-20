<script setup lang="ts">
import type { ResultView } from '~/components/result/Review.vue'

/** A saved attempt: its score, or that it is with an examiner, and the examiner's word once marked. */
const route = useRoute()
const id = String(route.params.id)
const { data, error, refresh } = await useFetch<ResultView & Record<string, any>>(`/api/attempts/${id}`)
useSeoMeta({ title: () => (data.value?.test?.title ? `Result — ${data.value.test.title}` : 'Result'), robots: 'noindex' })

// Marked while the page is open: the user-events plugin raises this.
const nuxtApp = useNuxtApp()
const off = nuxtApp.hook('ml:graded' as any, (attemptId: string) => {
  if (attemptId === id) refresh()
})
onBeforeUnmount(() => off?.())
</script>

<template>
  <AppPage
    title="Result"
    icon="i-lucide-award"
  >
    <template #actions>
      <UButton
        to="/results"
        label="My results"
        icon="i-lucide-chart-column"
        color="neutral"
        variant="ghost"
      />
    </template>
    <UEmpty
      v-if="error"
      icon="i-lucide-file-question"
      title="Result not found"
      description="It may have been removed, or it belongs to someone else."
      :actions="[{ label: 'My results', to: '/results' }]"
    />
    <ResultSummary
      v-else-if="data"
      :view="data"
      :review-to="`/results/${id}/review`"
    >
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
    </ResultSummary>
  </AppPage>
</template>
