<script setup lang="ts">
/**
 * What a candidate gets by paying, at the moment it is missing: a premium test, the explanations
 * in a review, or an examiner's marking. Leads to the plans.
 */
const props = withDefaults(defineProps<{ reason: 'premium' | 'credit' | 'explanations', count?: number, compact?: boolean }>(), { compact: false })
const route = useRoute()

const copy = computed(() => ({
  premium: {
    icon: 'i-lucide-lock-keyhole',
    art: '/illustrations/locked.svg',
    title: 'This test is part of Premium',
    description: 'Premium opens every test in the library and the explanation behind every answer. Or open just this test with credits you earn by inviting friends.'
  },
  credit: {
    icon: 'i-lucide-pen-line',
    art: '/illustrations/writing.svg',
    title: 'Have an examiner mark it',
    description: 'One marking credit gets this section a score out of 75 and written feedback from an examiner. Your answers are kept here meanwhile.'
  },
  explanations: {
    icon: 'i-lucide-lightbulb',
    art: '/illustrations/bulb.svg',
    title: props.count ? `${props.count} explanations are waiting in Premium` : 'Explanations are part of Premium',
    description: 'See why each answer is right, with the line in the passage that gives it away.'
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
      { label: reason === 'credit' ? 'Buy a marking' : 'See Premium', to, color: 'primary', variant: 'solid', size: 'sm' },
      ...(reason === 'premium' ? [{ label: 'Earn free credits', to: '/earn', icon: 'i-lucide-gift', color: 'primary' as const, variant: 'outline' as const, size: 'sm' as const }] : [])
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
          :label="reason === 'credit' ? 'Buy a marking' : 'See Premium'"
          icon="i-lucide-sparkles"
        />
        <UButton
          v-if="reason === 'premium'"
          to="/earn"
          label="Earn free credits"
          icon="i-lucide-gift"
          color="neutral"
          variant="outline"
        />
        <slot />
      </div>
    </div>
  </UCard>
</template>
