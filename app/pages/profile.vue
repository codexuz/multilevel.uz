<script setup lang="ts">
import { SECTION_META } from '~/types/exam'
import type { Paginated } from '~/types/models'

const { me } = useMe()

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
const page = ref(1)
const { data } = await useFetch<Paginated<AttemptRow>>('/api/me/attempts', { query: { page } })
const attempts = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const pageSize = computed(() => data.value?.pageSize ?? 20)

function statusColor(s: string) {
  return s === 'graded' ? 'success' : s === 'submitted' ? 'warning' : 'neutral'
}
</script>

<template>
  <UContainer class="py-8 max-w-3xl space-y-8">
    <div class="flex items-center gap-4">
      <UAvatar :src="me?.avatarUrl || undefined" :alt="me?.name || 'User'" size="xl" />
      <div>
        <h1 class="text-2xl font-bold">
          {{ me?.name || 'Your profile' }}
        </h1>
        <p class="text-muted text-sm">
          {{ me?.email }}
        </p>
      </div>
    </div>

    <!-- Stat chips -->
    <div class="grid grid-cols-3 gap-4">
      <UCard class="text-center">
        <p class="text-2xl font-bold">
          🔥 {{ me?.streakCount ?? 0 }}
        </p>
        <p class="text-xs text-muted">
          Day streak
        </p>
      </UCard>
      <UCard class="text-center">
        <p class="text-2xl font-bold text-primary">
          {{ me?.points ?? 0 }}
        </p>
        <p class="text-xs text-muted">
          Points
        </p>
      </UCard>
      <UCard class="text-center">
        <p class="text-2xl font-bold text-amber-500">
          {{ me?.coins ?? 0 }}
        </p>
        <p class="text-xs text-muted">
          Coins
        </p>
      </UCard>
    </div>

    <!-- Goals -->
    <UCard>
      <template #header>
        <h2 class="font-semibold">
          Learning goals
        </h2>
      </template>
      <dl class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt class="text-muted">
            Current level
          </dt>
          <dd class="font-medium">
            {{ me?.currentLevel || '—' }}
          </dd>
        </div>
        <div>
          <dt class="text-muted">
            Target
          </dt>
          <dd class="font-medium">
            {{ me?.targetLevel || (me?.targetScore != null ? `${me.targetScore} pts` : '—') }}
          </dd>
        </div>
        <div>
          <dt class="text-muted">
            Learning for
          </dt>
          <dd class="font-medium">
            {{ me?.learningDuration || '—' }}
          </dd>
        </div>
        <div>
          <dt class="text-muted">
            Plan
          </dt>
          <dd class="font-medium">
            {{ me?.isPremium ? 'Premium' : 'Free' }}
          </dd>
        </div>
      </dl>
    </UCard>

    <!-- Past attempts -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">
        Past attempts
      </h2>
      <UCard v-if="attempts.length" :ui="{ body: 'p-0 sm:p-0' }">
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
              <span v-if="a.totalScore != null" class="text-sm font-semibold">
                {{ a.totalScore }}<span class="text-muted">/{{ a.maxScore ?? '—' }}</span>
              </span>
              <UBadge :color="statusColor(a.status)" variant="subtle" :label="a.status" size="sm" />
            </div>
          </NuxtLink>
        </div>
      </UCard>
      <UAlert
        v-else
        icon="i-lucide-inbox"
        color="neutral"
        variant="subtle"
        title="No attempts yet"
        description="Take a test to see your results here."
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
    </section>
  </UContainer>
</template>
