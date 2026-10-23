<script setup lang="ts">
import type { ResultView } from '~/components/result/Review.vue'

const { t } = useI18n()

/** A guest's marked paper, full screen, from the result kept in this tab. */
definePageMeta({ layout: 'exam' })
const route = useRoute()
const slug = String(route.params.slug)
const skill = String(route.params.skill).toUpperCase()
useSeoMeta({ title: () => t('review.review'), robots: 'noindex' })

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
    :back-label="t('sit.backToTest')"
  >
    <!-- An IELTS paper is reviewed on the test's own screen; a Speaking one keeps its recordings page. -->
    <IxReview
      v-if="view && view.exam === 'IELTS' && view.skill !== 'SPEAKING'"
      :view="view"
      :back="back"
    />
    <ResultReview
      v-else-if="view"
      :view="view"
      :back="back"
    />
  </ExamLoadState>
</template>
