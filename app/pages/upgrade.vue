<script setup lang="ts">
definePageMeta({ layout: 'public', middleware: 'public-layout' })

const { me, loggedIn, isPremium, refresh } = useMe()
const toast = useToast()

const PREMIUM_COIN_COST = 500
// Display only — activation still happens via coins or the center.
const PREMIUM_PRICE = '60 000'
const PREMIUM_DURATION = '1.5 months'
const redeeming = ref(false)

const features = [
  'All Listening & Reading mock tests',
  'Writing tasks with examiner feedback',
  'Speaking parts + live partner calls',
  'Detailed score breakdowns',
  'New tests added regularly'
]

useSeoMeta({
  title: 'Multilevel Premium',
  description: 'Unlock the full Multilevel mock exam library with examiner feedback, speaking practice and detailed score breakdowns.',
  ogTitle: 'Multilevel Premium',
  ogDescription: 'Get full access to premium English mock exams and practice features.'
})

async function unlockWithCoins() {
  redeeming.value = true
  try {
    await $fetch('/api/me/redeem-premium', { method: 'POST' })
    await refresh()
    toast.add({ title: 'Premium unlocked!', color: 'success', icon: 'i-lucide-sparkles' })
  } catch (e) {
    toast.add({
      title: 'Could not unlock',
      description: (e as { data?: { message?: string } })?.data?.message ?? 'Please try again.',
      color: 'error'
    })
  } finally {
    redeeming.value = false
  }
}
</script>

<template>
  <UContainer class="py-12 max-w-3xl">
    <div class="text-center space-y-3">
      <UIcon
        name="i-lucide-sparkles"
        class="size-10 text-primary mx-auto"
      />
      <h1 class="text-3xl font-bold">
        Multilevel Premium
      </h1>
      <p class="text-muted">
        Unlock the full library of premium mock exams for {{ PREMIUM_PRICE }} so'm / {{ PREMIUM_DURATION }}.
      </p>
    </div>

    <UAlert
      v-if="isPremium"
      class="mt-8"
      color="success"
      variant="subtle"
      icon="i-lucide-check-circle"
      title="You're on Premium"
      description="Your premium access is active."
    />

    <UCard
      v-else
      class="mt-8"
    >
      <div class="text-center space-y-1">
        <p class="text-sm font-medium uppercase tracking-wide text-muted">
          Premium
        </p>
        <p class="text-4xl font-bold">
          {{ PREMIUM_PRICE }}
          <span class="text-2xl">so'm</span>
        </p>
        <p class="text-muted">
          {{ PREMIUM_DURATION }}
        </p>
        <p class="text-muted text-sm">
          Contact Us to activate premium access.
        </p>
      </div>
      <ul class="mt-6 space-y-3">
        <li
          v-for="f in features"
          :key="f"
          class="flex items-center gap-3"
        >
          <UIcon
            name="i-lucide-check"
            class="size-5 text-primary"
          />
          <span>{{ f }}</span>
        </li>
      </ul>
      <template #footer>
        <div class="space-y-3">
          <UButton
            v-if="loggedIn"
            block
            size="lg"
            color="primary"
            :loading="redeeming"
            :disabled="(me?.coins ?? 0) < PREMIUM_COIN_COST"
            icon="i-lucide-coins"
            :label="`Unlock with coins (${me?.coins ?? 0} / ${PREMIUM_COIN_COST})`"
            @click="unlockWithCoins"
          />
          <!-- Requesting access needs no account, so this always goes straight
               to Telegram rather than bouncing guests through /login. -->
          <UButton
            block
            size="lg"
            variant="subtle"
            to="https://t.me/javlon_developer"
            target="_blank"
            rel="noopener noreferrer"
            label="Contact us on Telegram"
            icon="i-simple-icons-telegram"
          />
        </div>
      </template>
    </UCard>
  </UContainer>
</template>
