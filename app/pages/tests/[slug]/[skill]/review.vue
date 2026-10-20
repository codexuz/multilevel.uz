<script setup lang="ts">
import type { ResultView } from '~/components/result/Review.vue'

/** A guest's marked paper, full screen, from the result kept in this tab. */
definePageMeta({ layout: 'exam' })
const route = useRoute()
const slug = String(route.params.slug)
const skill = String(route.params.skill).toUpperCase()
useSeoMeta({ title: 'Review', robots: 'noindex' })

const view = ref<ResultView | null>(null)
const ready = ref(false)
onMounted(() => {
  try {
    view.value = JSON.parse(sessionStorage.getItem(`ml.result.${slug}.${skill}`) ?? 'null')
  } catch {}
  ready.value = true
})
const back = `/tests/${slug}/${skill.toLowerCase()}/result`
</script>

<template>
  <ExamLoadState
    :loading="!ready"
    :error="ready && !view?.review ? 'There is nothing to review in this tab.' : null"
    :back-to="`/tests/${slug}`"
    back-label="Back to the test"
  >
    <ResultReview
      v-if="view"
      :view="view"
      :back="back"
    />
  </ExamLoadState>
</template>
