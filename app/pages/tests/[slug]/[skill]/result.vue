<script setup lang="ts">
import type { ResultView } from '~/components/result/Review.vue'

const { t } = useI18n()

definePageMeta({ guestLayout: true })

/**
 * A guest's result, shown once from this tab (sessionStorage) and kept nowhere. A signed-in
 * candidate's result lives at /results/{id}.
 */
const route = useRoute()
const slug = String(route.params.slug)
const skill = String(route.params.skill).toUpperCase()
useSeoMeta({ title: () => t('results.yourResult'), robots: 'noindex' })

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
    :title="t('review.result')"
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
      :title="t('results.noResult')"
      :description="t('results.noResultText')"
      :actions="[{ label: t('sit.backToTest'), to: `/tests/${slug}` }, { label: t('nav.signIn'), to: `/login?next=${encodeURIComponent(`/tests/${slug}`)}`, color: 'neutral', variant: 'outline' }]"
    />
  </AppPage>
</template>
