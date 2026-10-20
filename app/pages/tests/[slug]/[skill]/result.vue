<script setup lang="ts">
import type { ResultView } from '~/components/result/Review.vue'

/**
 * A guest's result, shown once from this tab (sessionStorage) and kept nowhere. A signed-in
 * candidate's result lives at /results/{id}.
 */
const route = useRoute()
const slug = String(route.params.slug)
const skill = String(route.params.skill).toUpperCase()
useSeoMeta({ title: 'Your result', robots: 'noindex' })

const view = ref<(ResultView & Record<string, any>) | null>(null)
const ready = ref(false)
onMounted(() => {
  try {
    view.value = JSON.parse(sessionStorage.getItem(`ml.result.${slug}.${skill}`) ?? 'null')
  } catch {}
  ready.value = true
})
</script>

<template>
  <AppPage
    title="Result"
    icon="i-lucide-award"
  >
    <div
      v-if="!ready"
      class="flex justify-center py-16"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 animate-spin text-muted"
      />
    </div>
    <ResultSummary
      v-else-if="view"
      :view="view"
      :review-to="`/tests/${slug}/${skill.toLowerCase()}/review`"
    />
    <UEmpty
      v-else
      icon="i-lucide-cloud-off"
      title="No result to show"
      description="A result for a guest is shown once, in the tab where the test was taken. Sign in to keep your results."
      :actions="[{ label: 'Back to the test', to: `/tests/${slug}` }, { label: 'Sign in', to: `/login?next=${encodeURIComponent(`/tests/${slug}`)}`, color: 'neutral', variant: 'outline' }]"
    />
  </AppPage>
</template>
