<script setup lang="ts">
import type { PublicCentre } from '~/components/centre/Card.vue'

/**
 * The learning centres that chose to be listed and whose licence runs: side by side, or running past
 * in a marquee when there are more than three. Below, a centre that wants to be here applies in a
 * modal (/centres?apply=1 opens it). Open to everyone and indexed.
 */
definePageMeta({ guestLayout: true })
const { t } = useI18n()
useSeoMeta({ title: () => t('centres.title'), description: () => t('centres.lead') })

const { data: centres } = await useFetch<PublicCentre[]>('/api/centres', { default: () => [] })
</script>

<template>
  <AppPage
    :title="t('nav.centres')"
    icon="i-lucide-building-2"
  >
    <div class="flex flex-col gap-8 w-full min-w-0">
      <div class="flex flex-col gap-2 items-center text-center">
        <h1 class="text-2xl sm:text-3xl font-bold text-highlighted">
          <i18n-t
            keypath="centres.heading"
            scope="global"
          >
            <template #accent>
              <span class="text-accent">{{ t('centres.titleAccent') }}</span>
            </template>
          </i18n-t>
        </h1>
        <p class="text-muted max-w-2xl">
          {{ t('centres.lead') }}
        </p>
      </div>

      <UEmpty
        v-if="!centres.length"
        icon="i-lucide-building-2"
        :title="t('centres.empty')"
        :description="t('centres.emptyText')"
      />
      <CentreStrip :centres="centres" />
    </div>
  </AppPage>
</template>
