<script setup lang="ts">
/**
 * What a candidate gets by paying, at the moment it is missing: a premium test, the explanations
 * in a review, or an examiner's marking. Leads to the plans.
 */
const props = withDefaults(defineProps<{ reason: 'premium' | 'credit' | 'explanations', count?: number, compact?: boolean }>(), { compact: false })
const route = useRoute()
const { t } = useI18n()

const copy = computed(() => ({
  premium: {
    icon: 'i-lucide-lock-keyhole',
    art: '/illustrations/locked.svg',
    title: t('paywall.premiumTitle'),
    description: t('paywall.premiumText')
  },
  credit: {
    icon: 'i-lucide-pen-line',
    art: '/illustrations/writing.svg',
    title: t('paywall.creditTitle'),
    description: t('paywall.creditText')
  },
  explanations: {
    icon: 'i-lucide-lightbulb',
    art: '/illustrations/bulb.svg',
    title: props.count ? t('paywall.explanationsCount', { n: props.count }, props.count) : t('paywall.explanationsTitle'),
    description: t('paywall.explanationsText')
  }
})[props.reason])
const to = computed(() => `/pricing?from=${encodeURIComponent(route.fullPath)}${props.reason === 'credit' ? '#markings' : ''}`)
</script>

<template>
  <UAlert
    v-if="compact"
    :icon="copy.icon"
    color="primary"
    variant="subtle"
    :title="copy.title"
    :description="copy.description"
    :actions="[
      { label: reason === 'credit' ? t('paywall.buyMarking') : t('home.seePremium'), to, color: 'primary', variant: 'solid', size: 'sm' },
      ...(reason === 'premium' ? [{ label: t('paywall.earn'), to: '/earn', icon: 'i-lucide-gift', color: 'primary' as const, variant: 'outline' as const, size: 'sm' as const }] : [])
    ]"
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
        <UButton
          :to="to"
          :label="reason === 'credit' ? t('paywall.buyMarking') : t('home.seePremium')"
          icon="i-lucide-sparkles"
        />
        <UButton
          v-if="reason === 'premium'"
          to="/earn"
          :label="t('paywall.earn')"
          icon="i-lucide-gift"
          color="neutral"
          variant="outline"
        />
        <slot />
      </div>
    </div>
  </UCard>
</template>
