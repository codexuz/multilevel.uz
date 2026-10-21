<script setup lang="ts">
import type { ResultView } from '~/components/result/Review.vue'

const { t } = useI18n()

/** A saved attempt's marked paper, full screen. */
definePageMeta({ layout: 'exam' })
const route = useRoute()
const id = String(route.params.id)
const { data, error, status } = await useFetch<ResultView>(`/api/attempts/${id}`)
useSeoMeta({ title: () => t('review.review'), robots: 'noindex' })
</script>

<template>
  <ExamLoadState
    :loading="status === 'pending'"
    :error="error ? 'This result could not be opened.' : (data && !data.review ? 'There is nothing to review.' : null)"
    :back-to="`/results/${id}`"
    :back-label="t('review.backToResult')"
  >
    <ResultReview
      v-if="data"
      :view="data"
      :back="`/results/${id}`"
    />
  </ExamLoadState>
</template>
