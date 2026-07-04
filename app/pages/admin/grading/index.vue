<script setup lang="ts">
import type { Database, Attempt, Section } from '~/types/database.types'
import { SECTION_META } from '~/types/exam'

definePageMeta({ layout: 'admin', middleware: 'staff' })

const supabase = useSupabaseClient<Database>()

const { data: queue } = await useAsyncData('grading-queue', async () => {
  const { data } = await supabase
    .from('attempts')
    .select('*, sections(type, title), tests(title), profiles:user_id(full_name)')
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: true })
  return (data as unknown as (Attempt & {
    sections: Section
    tests: { title: string }
    profiles: { full_name: string | null } | null
  })[]) ?? []
})
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold">
      Grading queue
    </h1>

    <UCard
      v-if="queue?.length"
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
            :name="SECTION_META[a.sections.type].icon"
            class="size-5 text-primary shrink-0"
          />
          <div class="flex-1 min-w-0">
            <p class="font-medium truncate">
              {{ a.tests.title }} — {{ a.sections.title }}
            </p>
            <p class="text-xs text-muted">
              {{ a.profiles?.full_name || 'Student' }} · submitted {{ a.submitted_at ? new Date(a.submitted_at).toLocaleString() : '' }}
            </p>
          </div>
          <UBadge
            color="warning"
            variant="subtle"
            :label="a.sections.type"
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
  </div>
</template>
