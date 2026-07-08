<script setup lang="ts">
import type { SectionType } from '~/types/exam'
import { SECTION_META } from '~/types/exam'
import type { Paginated } from '~/types/models'

definePageMeta({ layout: 'admin', middleware: 'staff' })

interface QueueRow {
  id: string
  submittedAt: string | null
  sectionType: SectionType
  sectionTitle: string
  testTitle: string
  studentName: string | null
}
const page = ref(1)
const { data } = await useFetch<Paginated<QueueRow>>('/api/admin/grading', { query: { page } })
const queue = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const pageSize = computed(() => data.value?.pageSize ?? 20)
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold">
      Grading queue
    </h1>

    <UCard
      v-if="queue.length"
      :ui="{ body: 'p-0 sm:p-0' }"
    >
      <div class="divide-y divide-default">
        <NuxtLink
          v-for="a in queue"
          :key="a.id"
          :to="`/admin/grading/${a.id}`"
          class="flex items-center gap-4 p-4 hover:bg-elevated/50"
        >
          <UIcon
            :name="SECTION_META[a.sectionType].icon"
            class="size-5 text-primary shrink-0"
          />
          <div class="flex-1 min-w-0">
            <p class="font-medium truncate">
              {{ a.testTitle }} — {{ a.sectionTitle }}
            </p>
            <p class="text-xs text-muted">
              {{ a.studentName || 'Student' }} · submitted {{ a.submittedAt ? new Date(a.submittedAt).toLocaleString() : '' }}
            </p>
          </div>
          <UBadge
            color="warning"
            variant="subtle"
            :label="a.sectionType"
            size="sm"
          />
          <UIcon
            name="i-lucide-chevron-right"
            class="size-4 text-muted"
          />
        </NuxtLink>
      </div>
    </UCard>

    <UAlert
      v-else
      icon="i-lucide-check-check"
      color="success"
      variant="subtle"
      title="All caught up"
      description="There are no writing or speaking submissions awaiting grading."
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
  </div>
</template>
