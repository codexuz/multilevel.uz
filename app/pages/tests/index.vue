<script setup lang="ts">
import type { TestDto, Paginated } from '~/types/models'

definePageMeta({ layout: 'public', middleware: 'public-layout' })

const { isPremium, loggedIn } = useMe()
const page = ref(1)
// Guests read the unauthenticated catalog; members get the full endpoint.
const endpoint = loggedIn.value ? '/api/tests' : '/api/catalog/tests'
const { data } = await useFetch<Paginated<TestDto>>(endpoint, { query: { page } })
const tests = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const pageSize = computed(() => data.value?.pageSize ?? 20)

useSeoMeta({
  title: 'Tests',
  description: 'Choose a Multilevel mock exam section to practice.'
})

function locked(t: TestDto) {
  return t.isPremium && !isPremium.value
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

    <div v-if="tests?.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <UCard v-for="t in tests" :key="t.id">
        <div class="flex items-start justify-between gap-2">
          <h3 class="font-semibold">
            {{ t.title }}
          </h3>
          <UBadge v-if="t.isPremium" color="primary" variant="subtle" icon="i-lucide-sparkles" label="Premium" size="sm" />
        </div>
        <p class="text-sm text-muted mt-1 line-clamp-2">
          {{ t.description || 'Full mock exam' }}
        </p>
        <div v-if="t.level" class="flex gap-2 mt-2">
          <UBadge color="neutral" variant="subtle" :label="t.level" size="sm" />
        </div>
        <template #footer>
          <UButton
            v-if="!loggedIn"
            to="/login"
            block
            label="Sign in to start"
            trailing-icon="i-lucide-arrow-right"
          />
          <UButton
            v-else-if="locked(t)"
            to="/upgrade"
            block
            color="primary"
            variant="subtle"
            icon="i-lucide-lock"
            label="Unlock with Premium"
          />
          <UButton v-else :to="`/tests/${t.id}`" block label="Open test" trailing-icon="i-lucide-arrow-right" />
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

    <div
      v-if="total > pageSize"
      class="flex justify-center"
    >
      <UPagination
        v-model:page="page"
        :total="total"
        :items-per-page="pageSize"
      />
    </div>
  </UContainer>
</template>
