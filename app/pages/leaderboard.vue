<script setup lang="ts">
import type { LeaderboardRow, Paginated } from '~/types/models'

const { me } = useMe()
const page = ref(1)
const { data } = await useFetch<Paginated<LeaderboardRow>>('/api/leaderboard', { query: { page } })
const rows = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const pageSize = computed(() => data.value?.pageSize ?? 50)

function medal(rank: number) {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
}
</script>

<template>
  <UContainer class="py-8 max-w-2xl space-y-6">
    <div>
      <h1 class="text-2xl font-bold flex items-center gap-2">
        <UIcon name="i-lucide-trophy" class="text-amber-500" /> Leaderboard
      </h1>
      <p class="text-muted">
        Top learners ranked by points earned.
      </p>
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <div class="divide-y divide-default">
        <div
          v-for="r in rows"
          :key="r.id"
          class="flex items-center gap-4 p-4"
          :class="r.id === me?.id ? 'bg-primary/5' : ''"
        >
          <div class="w-8 text-center font-bold shrink-0">
            <span v-if="medal(r.rank)" class="text-lg">{{ medal(r.rank) }}</span>
            <span v-else class="text-muted">{{ r.rank }}</span>
          </div>
          <UAvatar :src="r.avatarUrl || undefined" :alt="r.name || 'User'" size="sm" />
          <div class="flex-1 min-w-0">
            <p class="font-medium truncate">
              {{ r.name || 'Anonymous' }}
              <UBadge v-if="r.id === me?.id" size="sm" color="primary" variant="subtle" label="You" />
            </p>
            <p class="text-xs text-muted flex items-center gap-2">
              <span v-if="r.currentLevel">{{ r.currentLevel }}</span>
              <span>🔥 {{ r.streakCount }}</span>
            </p>
          </div>
          <div class="flex items-center gap-1 font-semibold text-primary shrink-0">
            <UIcon name="i-lucide-star" class="size-4" />{{ r.points }}
          </div>
        </div>
      </div>
    </UCard>

    <UAlert
      v-if="!rows.length"
      icon="i-lucide-inbox"
      color="neutral"
      variant="subtle"
      title="No rankings yet"
      description="Complete a test to get on the board."
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
