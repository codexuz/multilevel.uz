<script setup lang="ts">
/** The work a student's groups set them: what is still to do first, with due dates; hidden outside a class. */
const { t } = useI18n()
interface Item {
  id: string
  skill: string
  partNumber: number | null
  note: string | null
  dueAt: string | null
  test: { slug: string, title: string } | null
  to: string | null
  group: string
  mine: { attemptId: string, score: number | null, band?: number | null, status: string } | null
}
const { data } = await useFetch<{ groups: { id: string, name: string }[], items: Item[] }>('/api/me/assignments', { lazy: true, server: false })
const items = computed(() => [...(data.value?.items ?? [])].sort((a, b) => Number(!!a.mine) - Number(!!b.mine)).slice(0, 6))
const todo = computed(() => (data.value?.items ?? []).filter(i => !i.mine).length)
const overdue = (i: Item) => !i.mine && !!i.dueAt && new Date(i.dueAt) < new Date()
</script>

<template>
  <UCard
    v-if="data?.groups.length"
    :ui="{ body: 'p-0 sm:p-0' }"
  >
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon
          name="i-lucide-school"
          class="size-5 text-primary"
        />
        <h2 class="font-semibold text-highlighted flex-1">
          {{ t('work.fromClass', data.groups.length) }}
        </h2>
        <UBadge
          :label="todo ? t('work.toDo', { n: todo }) : t('work.allDone')"
          :color="todo ? 'warning' : 'success'"
          variant="subtle"
        />
      </div>
      <p class="text-sm text-muted mt-1">
        {{ data.groups.map(g => g.name).join(', ') }}
      </p>
    </template>
    <p
      v-if="!items.length"
      class="text-sm text-muted px-6 py-5"
    >
      {{ t('work.none') }}
    </p>
    <ul class="divide-y divide-default">
      <li
        v-for="i in items"
        :key="i.id"
        class="flex items-center gap-3 px-4 sm:px-6 py-3"
      >
        <UIcon
          :name="i.mine ? 'i-lucide-circle-check' : 'i-lucide-circle'"
          :class="i.mine ? 'text-success' : 'text-dimmed'"
          class="size-5 shrink-0"
        />
        <div class="flex-1 min-w-0">
          <p
            class="text-sm font-medium truncate"
            :class="i.mine ? 'text-muted' : 'text-highlighted'"
          >
            {{ skillLabel(i.skill) }}{{ i.partNumber ? ` ${partName(i.skill, i.partNumber)}` : '' }} · {{ i.test?.title }}
          </p>
          <p
            class="text-xs truncate"
            :class="overdue(i) ? 'text-error' : 'text-muted'"
          >
            {{ i.group }}{{ i.dueAt ? ` · ${t('work.due', { date: formatDate(i.dueAt, true) })}` : '' }}{{ i.note ? ` · ${i.note}` : '' }}
          </p>
        </div>
        <UButton
          v-if="i.mine"
          :to="`/results/${i.mine.attemptId}`"
          :label="resultChip(i.mine) ?? t('work.handedIn')"
          size="xs"
          color="neutral"
          variant="outline"
        />
        <UButton
          v-else-if="i.to"
          :to="i.to"
          :label="t('common.start')"
          size="xs"
          trailing-icon="i-lucide-arrow-right"
        />
      </li>
    </ul>
  </UCard>
</template>
