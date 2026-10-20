<script setup lang="ts">
/** My saved attempts, newest first: each with its skill, score and level, opening the result. */
useSeoMeta({ title: 'My results', robots: 'noindex' })

interface Row { id: string, skill: string, status: string, test: { slug: string, title: string } | null, submittedAt: string, correct: number | null, total: number | null, score: number | null, cefrLevel: string | null }

const page = ref(1)
const { data, status } = await useFetch<{ items: Row[], total: number, pages: number }>('/api/me/attempts', { query: { page, limit: 20 }, lazy: true })
</script>

<template>
  <AppPage
    title="My results"
    icon="i-lucide-chart-column"
  >
    <div class="flex flex-col gap-4 max-w-3xl w-full">
      <h1 class="text-2xl sm:text-3xl font-bold text-highlighted">
        My <span class="text-accent">results</span>
      </h1>

      <div
        v-if="status === 'pending' && !data"
        class="grid gap-2"
      >
        <USkeleton
          v-for="i in 5"
          :key="i"
          class="h-18 rounded-xl"
        />
      </div>

      <div
        v-else-if="data?.items?.length"
        class="rounded-xl ring ring-default divide-y divide-default overflow-hidden"
      >
        <NuxtLink
          v-for="r in data.items"
          :key="r.id"
          :to="`/results/${r.id}`"
          class="flex items-center gap-3 sm:gap-4 px-4 py-3 hover:bg-muted transition-colors"
        >
          <div class="size-11 shrink-0 rounded-xl bg-elevated grid place-items-center">
            <img
              :src="SKILL_ART[r.skill]"
              alt=""
              class="size-7"
            >
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-medium text-highlighted truncate">{{ r.test?.title || 'Removed test' }}</p>
            <p class="text-xs text-muted truncate">
              {{ skillLabel(r.skill) }} · {{ relativeTime(r.submittedAt) }}<span v-if="r.total"> · {{ r.correct }}/{{ r.total }} correct</span>
            </p>
          </div>
          <div
            v-if="r.score != null"
            class="text-right shrink-0"
          >
            <p class="text-lg font-bold text-highlighted tabular-nums leading-none">{{ fmtScore(r.score) }}<span class="text-xs font-medium text-muted">/75</span></p>
            <UBadge
              :label="(r.cefrLevel ?? cefrOf(r.score)) === 'A2' ? 'Below B1' : (r.cefrLevel ?? cefrOf(r.score))!"
              :color="scoreColor(r.score)"
              variant="soft"
              size="sm"
              class="mt-1"
            />
          </div>
          <UBadge
            v-else
            label="With an examiner"
            color="warning"
            variant="soft"
            size="sm"
            class="shrink-0"
          />
          <UIcon
            name="i-lucide-chevron-right"
            class="size-4 text-dimmed shrink-0 max-sm:hidden"
          />
        </NuxtLink>
      </div>

      <div
        v-else
        class="flex flex-col items-center text-center gap-3 rounded-xl ring ring-default px-6 py-12"
      >
        <img
          src="/illustrations/chart.svg"
          alt=""
          class="size-16"
        >
        <p class="font-semibold text-highlighted">
          No results yet
        </p>
        <p class="text-sm text-muted max-w-xs">
          Take a test while signed in and every result is kept here.
        </p>
        <UButton
          to="/tests"
          label="Browse tests"
          class="mt-1"
        />
      </div>

      <div
        v-if="(data?.pages ?? 1) > 1"
        class="flex justify-center"
      >
        <UPagination
          v-model:page="page"
          :total="data?.total ?? 0"
          :items-per-page="20"
        />
      </div>
    </div>
  </AppPage>
</template>
