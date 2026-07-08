<script setup lang="ts">
import type { TestDto, Paginated } from '~/types/models'
import { SECTION_META } from '~/types/exam'

const { me, isPremium } = useMe()

// Dashboard shows only the first few of each list — request small pages.
const { data: allTests } = await useFetch<Paginated<TestDto>>('/api/tests', { query: { pageSize: 6 } })
const tests = computed(() => allTests.value?.items ?? [])

interface AttemptRow {
  id: string
  status: string
  createdAt: string
  totalScore: number | null
  maxScore: number | null
  sectionType: string
  sectionTitle: string
  testTitle: string
}
const { data: allAttempts } = await useFetch<Paginated<AttemptRow>>('/api/me/attempts', { query: { pageSize: 5 } })
const attempts = computed(() => allAttempts.value?.items ?? [])

function statusColor(s: string) {
  return s === 'graded' ? 'success' : s === 'submitted' ? 'warning' : 'neutral'
}
</script>

<template>
  <UContainer class="py-8 space-y-8">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">
          Welcome back{{ me?.name ? `, ${me.name.split(' ')[0]}` : '' }}
        </h1>
        <p class="text-muted">
          Pick a test to practise or jump into a live speaking session.
        </p>
      </div>
      <UBadge
        :color="isPremium ? 'primary' : 'neutral'"
        variant="subtle"
        size="lg"
        :icon="isPremium ? 'i-lucide-sparkles' : 'i-lucide-lock'"
        :label="isPremium ? 'Premium' : 'Free plan'"
      />
    </div>

    <!-- Quick actions -->
    <div class="grid gap-4 sm:grid-cols-3">
      <UPageCard
        to="/tests"
        icon="i-lucide-clipboard-list"
        title="All tests"
        description="Browse the full library"
        spotlight
      />
      <UPageCard
        to="/speaking/live"
        icon="i-lucide-mic"
        title="Speaking Live"
        description="Get matched with a partner"
        spotlight
      />
      <UPageCard
        v-if="!isPremium"
        to="/upgrade"
        icon="i-lucide-sparkles"
        title="Go Premium"
        description="Unlock all mock exams"
        spotlight
      />
      <UPageCard
        v-else
        to="/tests"
        icon="i-lucide-crown"
        title="Premium active"
        description="All tests unlocked"
        spotlight
      />
    </div>

    <!-- Available tests -->
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">
          Available tests
        </h2>
        <UButton
          to="/tests"
          variant="link"
          trailing-icon="i-lucide-arrow-right"
          label="View all"
        />
      </div>

      <div
        v-if="tests?.length"
        class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <UCard
          v-for="t in tests"
          :key="t.id"
          class="hover:ring-primary transition"
        >
          <div class="flex items-start justify-between gap-2">
            <h3 class="font-semibold">
              {{ t.title }}
            </h3>
            <UBadge
              v-if="t.isPremium"
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
          <template #footer>
            <UButton
              :to="`/tests/${t.id}`"
              block
              label="Open"
              trailing-icon="i-lucide-arrow-right"
            />
          </template>
        </UCard>
      </div>
      <UAlert
        v-else
        icon="i-lucide-info"
        color="neutral"
        variant="subtle"
        title="No tests yet"
        description="Published tests will appear here."
      />
    </section>

    <!-- Recent attempts -->
    <section
      v-if="attempts?.length"
      class="space-y-4"
    >
      <h2 class="text-lg font-semibold">
        Recent activity
      </h2>
      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <div class="divide-y divide-default">
          <NuxtLink
            v-for="a in attempts"
            :key="a.id"
            :to="`/results/${a.id}`"
            class="flex items-center justify-between gap-4 p-4 hover:bg-elevated/50"
          >
            <div class="flex items-center gap-3 min-w-0">
              <UIcon
                :name="SECTION_META[a.sectionType as keyof typeof SECTION_META]?.icon || 'i-lucide-file'"
                class="size-5 text-primary shrink-0"
              />
              <div class="min-w-0">
                <p class="font-medium truncate">
                  {{ a.testTitle }} — {{ a.sectionTitle }}
                </p>
                <p class="text-xs text-muted">
                  {{ new Date(a.createdAt).toLocaleString() }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <span
                v-if="a.totalScore != null"
                class="text-sm font-semibold"
              >{{ a.totalScore }}<span class="text-muted">/{{ a.maxScore ?? '—' }}</span></span>
              <UBadge
                :color="statusColor(a.status)"
                variant="subtle"
                :label="a.status"
                size="sm"
              />
            </div>
          </NuxtLink>
        </div>
      </UCard>
    </section>
  </UContainer>
</template>
