<script setup lang="ts">
/**
 * Writing and Speaking handed in for practice (the IELTS app's Marking), newest first: a centre's
 * teachers see their students', markers the rest; admins see all and can narrow it.
 */
definePageMeta({ middleware: 'marker' })
useSeoMeta({ title: 'Marking', robots: 'noindex' })

interface Row { id: string, skill: string, exam?: string, status: string, user?: { name: string, avatarUrl?: string | null }, test: { title: string } | null, submittedAt: string, score: number | null, band?: number | null, cefrLevel: string | null, centre: string | null }

const status = ref<'SUBMITTED' | 'GRADED'>('SUBMITTED')
const from = ref<'ALL' | 'POOL' | 'CENTRES'>('ALL')
const page = ref(1)
watch([status, from], () => (page.value = 1))
const { isAdmin } = useMe()
const { data, status: loadState } = await useFetch<{ items: Row[], total: number, pages: number }>('/api/admin/marking', {
  query: { status, page, limit: 20, from: computed(() => (from.value === 'ALL' ? undefined : from.value)) },
  lazy: true
})
const fromItems = [{ label: 'Everyone', value: 'ALL' }, { label: 'Outside centres', value: 'POOL' }, { label: 'Centre students', value: 'CENTRES' }]
const tabs = [{ label: 'To mark', value: 'SUBMITTED' }, { label: 'Marked', value: 'GRADED' }]
</script>

<template>
  <AppPage
    title="Marking"
    icon="i-lucide-pen-line"
  >
    <template #toolbar>
      <UDashboardToolbar>
        <template #left>
          <UTabs
            v-model="status"
            :items="tabs"
            :content="false"
            size="sm"
            class="py-1"
          />
        </template>
        <template #right>
          <USelect
            v-if="isAdmin"
            v-model="from"
            :items="fromItems"
            size="sm"
            class="w-40"
            data-testid="marking-from"
          />
        </template>
      </UDashboardToolbar>
    </template>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <ul class="divide-y divide-default">
        <li
          v-if="loadState === 'pending' && !data"
          class="p-4"
        >
          <USkeleton class="h-40" />
        </li>
        <li
          v-for="a in data?.items ?? []"
          :key="a.id"
        >
          <NuxtLink
            :to="`/marking/${a.id}`"
            class="px-4 py-3 flex items-center gap-4 hover:bg-elevated/50"
          >
            <UUser
              :name="a.user?.name || '—'"
              :avatar="{ src: a.user?.avatarUrl ?? undefined, alt: a.user?.name }"
              size="sm"
              class="w-44 shrink-0 max-sm:w-auto"
            />
            <div class="min-w-0 flex-1">
              <p class="font-medium text-highlighted truncate flex items-center gap-2">
                {{ skillLabel(a.skill) }}
                <UBadge
                  v-if="a.centre"
                  :label="a.centre"
                  icon="i-lucide-school"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                />
              </p>
              <p class="text-xs text-muted truncate">{{ a.test?.title ?? 'Removed test' }} · {{ relativeTime(a.submittedAt) }}</p>
            </div>
            <UBadge
              v-if="a.status === 'GRADED'"
              :label="`${resultChip(a)} · ${resultLevel(a)}`"
              :color="resultColor(a)"
              variant="soft"
              class="tabular-nums"
            />
            <UIcon
              name="i-lucide-chevron-right"
              class="text-muted"
            />
          </NuxtLink>
        </li>
        <li
          v-if="loadState !== 'pending' && !data?.items?.length"
          class="p-8"
        >
          <UEmpty
            :icon="status === 'SUBMITTED' ? 'i-lucide-party-popper' : 'i-lucide-pen-line'"
            :title="status === 'SUBMITTED' ? 'Nothing to mark' : 'Nothing marked yet'"
            :description="status === 'SUBMITTED' ? 'Everything handed in has been marked.' : undefined"
            variant="naked"
          />
        </li>
      </ul>
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
