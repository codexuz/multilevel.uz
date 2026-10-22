<script setup lang="ts">
import type { PublicCentre } from './Card.vue'

/**
 * The learning centres on the site, and the way for another to join. Up to three sit side by side
 * (one alone, centred); more than three run past in a marquee that stops while the pointer or focus
 * is on it, and stands still for anyone who asked for less motion. Apply opens the request form.
 */
const props = withDefaults(defineProps<{ centres: PublicCentre[], applyLabel?: string }>(), { applyLabel: undefined })
const { t } = useI18n()
const applyOpen = ref(false)

const marquee = computed(() => props.centres.length > 3)
// Each loop takes about four seconds a centre, so a long list does not race past.
const duration = computed(() => `${Math.max(20, props.centres.length * 4)}s`)

// /centres?apply=1 (an old /centres/apply link, or a Join button elsewhere) opens the form.
const route = useRoute()
onMounted(() => {
  if (route.query.apply) applyOpen.value = true
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <div
      v-if="marquee"
      class="centre-marquee relative overflow-hidden -mx-4 px-4 sm:mx-0 sm:px-0"
      :style="{ '--marquee-duration': duration }"
    >
      <div class="centre-marquee-track flex w-max gap-4">
        <!-- The list twice, so the loop is seamless; the copy is hidden from screen readers. -->
        <div
          v-for="copy in 2"
          :key="copy"
          class="flex gap-4"
          :aria-hidden="copy === 2 ? 'true' : undefined"
        >
          <CentreCard
            v-for="c in centres"
            :key="`${copy}-${c.id}`"
            :centre="c"
            class="w-72 shrink-0"
          />
        </div>
      </div>
      <div
        class="pointer-events-none absolute inset-y-0 left-0 w-12 bg-linear-to-r from-default to-transparent"
        aria-hidden="true"
      />
      <div
        class="pointer-events-none absolute inset-y-0 right-0 w-12 bg-linear-to-l from-default to-transparent"
        aria-hidden="true"
      />
    </div>
    <div
      v-else-if="centres.length"
      class="grid gap-4"
      :class="centres.length === 1 ? 'max-w-sm w-full mx-auto' : centres.length === 2 ? 'sm:grid-cols-2 max-w-3xl w-full mx-auto' : 'sm:grid-cols-2 lg:grid-cols-3'"
    >
      <CentreCard
        v-for="c in centres"
        :key="c.id"
        :centre="c"
      />
    </div>

    <!-- For a centre that wants to be here -->
    <div class="flex flex-col items-center text-center gap-3">
      <p class="text-sm text-muted max-w-md">
        {{ t('centres.ctaText') }}
      </p>
      <UButton
        :label="applyLabel ?? t('centres.apply')"
        icon="i-lucide-school"
        size="lg"
        @click="applyOpen = true"
      />
    </div>
    <CentreApplyModal v-model:open="applyOpen" />
  </div>
</template>

<style scoped>
.centre-marquee-track {
  animation: centre-marquee var(--marquee-duration, 30s) linear infinite;
}
.centre-marquee:hover .centre-marquee-track,
.centre-marquee:focus-within .centre-marquee-track {
  animation-play-state: paused;
}
@keyframes centre-marquee {
  from { transform: translateX(0); }
  to { transform: translateX(calc(-50% - 0.5rem)); }
}
/* Less motion: no loop, the row scrolls by hand. */
@media (prefers-reduced-motion: reduce) {
  .centre-marquee { overflow-x: auto; }
  .centre-marquee-track { animation: none; }
}
</style>
