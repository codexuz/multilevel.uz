<script setup lang="ts">
/**
 * What is missing, at the moment it is: a premium test (opened with a test pack, or with credits
 * earned by inviting friends), or today's explanations, used up (10 results a day; more tomorrow).
 */
const props = withDefaults(defineProps<{ reason: 'premium' | 'explanations', count?: number, limit?: number | null, compact?: boolean }>(), { compact: false })
const { t } = useI18n()

const copy = computed(() => ({
  premium: {
    icon: 'i-lucide-lock-keyhole',
    art: '/illustrations/locked.svg',
    title: t('paywall.premiumTitle'),
    description: t('paywall.premiumText')
  },
  explanations: {
    icon: 'i-lucide-lightbulb',
    art: '/illustrations/bulb.svg',
    title: props.count ? t('paywall.explanationsCount', { n: props.count }, props.count) : t('paywall.explanationsTitle'),
    description: t('paywall.explanationsText', { n: props.limit ?? 10 })
  }
})[props.reason])
const premium = computed(() => props.reason === 'premium')
</script>

<template>
  <UAlert
    v-if="compact"
    :icon="copy.icon"
    :color="premium ? 'primary' : 'neutral'"
    variant="subtle"
    :title="copy.title"
    :description="copy.description"
    :actions="premium ? [
      { label: t('paywall.packs'), to: '/tests?view=packs', icon: 'i-lucide-package', color: 'primary', variant: 'solid', size: 'sm' },
      { label: t('paywall.earn'), to: '/earn', icon: 'i-lucide-gift', color: 'primary', variant: 'outline', size: 'sm' }
    ] : []"
  />
  <UCard
    v-else
    class="max-w-md w-full mx-auto"
  >
    <div class="flex flex-col items-center text-center gap-3 py-2">
      <img
        :src="copy.art"
        alt=""
        class="size-16 drop-shadow-lg"
      >
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-highlighted">
          {{ copy.title }}
        </h2>
        <p class="text-sm text-muted text-pretty">
          {{ copy.description }}
        </p>
      </div>
      <div class="flex flex-wrap justify-center gap-2 pt-1">
        <template v-if="premium">
          <UButton
            to="/tests?view=packs"
            :label="t('paywall.packs')"
            icon="i-lucide-package"
          />
          <UButton
            to="/earn"
            :label="t('paywall.earn')"
            icon="i-lucide-gift"
            color="neutral"
            variant="outline"
          />
        </template>
        <slot />
      </div>
    </div>
  </UCard>
</template>
