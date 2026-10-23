<script setup lang="ts">
import type { TestStatus } from '~/types/ielts'

/**
 * The tests a library item is placed in, as badges that open the test (at most two, then "+N" with
 * the rest on hover); "Not in a test" when it is in none.
 */
const props = defineProps<{ tests?: { id: string, title: string, status: TestStatus }[] }>()
const SHOWN = 2
const list = computed(() => props.tests ?? [])
const STATUS_COLOR: Record<string, 'success' | 'neutral' | 'warning'> = { PUBLISHED: 'success', DRAFT: 'neutral', ARCHIVED: 'neutral' }
</script>

<template>
  <div
    class="flex flex-wrap items-center justify-end gap-1 max-w-80"
    data-testid="test-badges"
  >
    <template v-if="list.length">
      <UBadge
        v-for="test in list.slice(0, SHOWN)"
        :key="test.id"
        :label="test.title"
        icon="i-lucide-file-text"
        :color="STATUS_COLOR[test.status] ?? 'neutral'"
        variant="soft"
        size="sm"
        class="max-w-44 cursor-pointer hover:ring-1 hover:ring-current"
        :class="test.status === 'ARCHIVED' ? 'opacity-60' : ''"
        :title="`${test.title} · ${test.status.toLowerCase()}`"
        @click.stop="navigateTo(`/builder/tests/${test.id}`)"
      />
      <UTooltip
        v-if="list.length > SHOWN"
        :text="list.slice(SHOWN).map(x => x.title).join(', ')"
      >
        <UBadge
          :label="`+${list.length - SHOWN}`"
          color="neutral"
          variant="outline"
          size="sm"
        />
      </UTooltip>
    </template>
    <UBadge
      v-else
      label="Not in a test"
      color="warning"
      variant="subtle"
      size="sm"
    />
  </div>
</template>
