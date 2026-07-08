<script setup lang="ts">
const { me, loggedIn, isPremium, refresh } = useMe()
const toast = useToast()

const PREMIUM_COIN_COST = 500
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
        Unlock the full library of premium mock exams.
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
        <p class="text-4xl font-bold">
          Premium
        </p>
        <p class="text-muted text-sm">
          Contact your center to activate premium access.
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
          <UButton
            block
            size="lg"
            variant="subtle"
            :to="loggedIn ? undefined : '/login'"
            label="Request premium access"
            icon="i-lucide-mail"
          />
        </div>
      </template>
    </UCard>
  </UContainer>
</template>
