<script setup lang="ts">
/** One AI review, opened again later (from the Telegram message, say). */
const { t } = useI18n()
useSeoMeta({ title: () => t('ai.feedback'), robots: 'noindex' })
const route = useRoute()
</script>

<template>
  <AppPage
    :title="t('ai.feedback')"
    icon="i-lucide-sparkles"
  >
    <div class="max-w-3xl w-full flex flex-col gap-4">
      <h1 class="text-2xl sm:text-3xl font-bold text-highlighted">
        AI <span class="text-accent">feedback</span>
      </h1>
      <AiWritingFeedback :review-id="String(route.params.id)" />
    </div>
  </AppPage>
</template>
