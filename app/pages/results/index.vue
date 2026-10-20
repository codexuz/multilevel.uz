<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

/** My saved attempts, newest first (the Results page of the erp-lms IELTS app). */
useSeoMeta({ title: 'My results', robots: 'noindex' })

interface Row { id: string, skill: string, status: string, test: { slug: string, title: string } | null, submittedAt: string, correct: number | null, total: number | null, score: number | null, cefrLevel: string | null }

const page = ref(1)
const { data, status } = await useFetch<{ items: Row[], total: number, pages: number }>('/api/me/attempts', { query: { page, limit: 20 }, lazy: true })

const columns: TableColumn<Row>[] = [
  { id: 'title', header: 'Test' },
  { id: 'skill', header: 'Section' },
  { id: 'score', header: 'Score' },
  { id: 'status', header: 'Status' },
  { id: 'date', header: 'Date', meta: { class: { th: 'max-md:hidden', td: 'max-md:hidden' } } }
]
const STATUS: Record<string, { label: string, color: 'warning' | 'success' }> = {
  SUBMITTED: { label: 'With an examiner', color: 'warning' },
  GRADED: { label: 'Marked', color: 'success' }
}
</script>

<template>
  <AppPage
    title="My results"
    icon="i-lucide-chart-column"
  >
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <UTable
        :data="data?.items ?? []"
        :columns="columns"
        :loading="status === 'pending'"
        class="cursor-pointer"
        @select="(_e: Event, row: any) => navigateTo(`/results/${row.original.id}`)"
      >
        <template #title-cell="{ row }">
          <p class="font-medium text-highlighted">
            {{ row.original.test?.title || 'Removed test' }}
          </p>
        </template>
        <template #skill-cell="{ row }">
          <span class="text-sm">{{ skillLabel(row.original.skill) }}</span>
        </template>
        <template #score-cell="{ row }">
          <div class="flex items-center gap-2">
            <UBadge
              :label="row.original.score == null ? '—' : `${fmtScore(row.original.score)} · ${row.original.cefrLevel ?? cefrOf(row.original.score)}`"
              :color="scoreColor(row.original.score)"
              variant="soft"
              class="tabular-nums"
            />
            <span
              v-if="row.original.total"
              class="text-xs text-muted tabular-nums"
            >{{ row.original.correct }}/{{ row.original.total }}</span>
          </div>
        </template>
        <template #status-cell="{ row }">
          <UBadge
            :label="STATUS[row.original.status]?.label ?? row.original.status"
            :color="STATUS[row.original.status]?.color ?? 'neutral'"
            variant="subtle"
          />
        </template>
        <template #date-cell="{ row }">
          <span class="text-sm text-muted">{{ relativeTime(row.original.submittedAt) }}</span>
        </template>
        <template #empty>
          <UEmpty
            icon="i-lucide-clipboard-list"
            title="No results yet"
            description="Take a test while signed in and your results are kept here."
            :actions="[{ label: 'Browse tests', to: '/tests' }]"
            variant="naked"
          />
        </template>
      </UTable>
    </UCard>
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
  </AppPage>
</template>
