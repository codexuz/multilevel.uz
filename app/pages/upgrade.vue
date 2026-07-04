<script setup lang="ts">
const user = useSupabaseUser()
const { subscription, isPremium } = useSubscription()

const features = [
  'All Listening & Reading mock tests',
  'Writing tasks with examiner feedback',
  'Speaking parts + live partner calls',
  'Detailed score breakdowns',
  'New tests added regularly'
]
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
      :description="subscription?.current_period_end
        ? `Active until ${new Date(subscription.current_period_end).toLocaleDateString()}`
        : 'Your premium access is active.'"
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
        <UButton
          block
          size="lg"
          :to="user ? undefined : '/login'"
          label="Request premium access"
          icon="i-lucide-mail"
        />
      </template>
    </UCard>
  </UContainer>
</template>
