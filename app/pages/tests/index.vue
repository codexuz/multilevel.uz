<script setup lang="ts">
import type { Test } from '~/types/database.types'

const supabase = useSupabaseClient()
const { isPremium } = useSubscription()

const { data: tests } = await useAsyncData('tests-list', async () => {
  const { data } = await supabase
    .from('tests')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
  return (data as Test[]) ?? []
})

function locked(t: Test) {
  return t.is_premium && !isPremium.value
}
</script>

<template>
  <UContainer class="py-8 space-y-6">
    <div>
      <h1 class="text-2xl font-bold">
        Tests
      </h1>
      <p class="text-muted">
        Choose a mock exam and take any section.
      </p>
    </div>

    <div
      v-if="tests?.length"
      class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <UCard
        v-for="t in tests"
        :key="t.id"
      >
        <div class="flex items-start justify-between gap-2">
          <h3 class="font-semibold">
            {{ t.title }}
          </h3>
          <UBadge
            v-if="t.is_premium"
            color="primary"
            variant="subtle"
            icon="i-lucide-sparkles"
            label="Premium"
            size="sm"
          />
        </div>
        <p class="text-sm text-muted mt-1 line-clamp-2">
          {{ t.description || 'Full mock exam' }}
        </p>
        <div class="flex gap-2 mt-2">
          <UBadge
            v-if="t.level"
            color="neutral"
            variant="subtle"
            :label="t.level"
            size="sm"
          />
        </div>
        <template #footer>
          <UButton
            v-if="locked(t)"
            to="/upgrade"
            block
            color="primary"
            variant="subtle"
            icon="i-lucide-lock"
            label="Unlock with Premium"
          />
          <UButton
            v-else
            :to="`/tests/${t.id}`"
            block
            label="Open test"
            trailing-icon="i-lucide-arrow-right"
          />
        </template>
      </UCard>
    </div>

    <UAlert
      v-else
      icon="i-lucide-inbox"
      color="neutral"
      variant="subtle"
      title="No tests available yet"
      description="Check back soon."
    />
  </UContainer>
</template>
