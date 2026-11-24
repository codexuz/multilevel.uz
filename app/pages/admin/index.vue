<script setup lang="ts">
/**
 * The Admin panel's home: users, tests taken, live mocks and courses at a glance; tests taken per
 * day by exam; where to go next; the latest live mocks and tests; and students by level.
 */
definePageMeta({ middleware: 'admin' })

interface DashboardData {
  days: number
  kpis: {
    totalUsers: number
    usersGrowthPct: number
    totalTests: number
    testsGrowthPct: number
    liveMocksTotal: number
    liveMocksOngoing: number
    activePacks: number
    totalCourses: number
    pendingMarking: number
  }
  examActivity: Array<{ day: string, ielts: number, cefr: number }>
  recentExams: Array<{ id: string, title: string, type: 'IELTS' | 'CEFR', candidates: number, status: 'Finished' | 'Ongoing' | 'Scheduled' | 'Published', date: string, to: string }>
  cefrDistribution: Array<{ level: string, count: number, percent: number }>
}

const { t, locale } = useI18n()
const { me } = useMe()
useSeoMeta({ title: () => t('panel.dashboard'), robots: 'noindex' })

const days = ref(30)
const dayOptions = computed(() => [7, 30, 90].map(n => ({ label: t('adash.lastDays', { n }), value: n })))
const { data, status } = await useFetch<DashboardData>('/api/admin/dashboard', { query: computed(() => ({ days: days.value })) })
const k = computed(() => data.value?.kpis)
const firstName = computed(() => (me.value?.name || '').split(/\s+/)[0] || '')
const growth = (n: number) => (n > 0 ? `+${n}%` : `${n}%`)

const shortDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : localeDate(d, locale.value, { month: 'short', day: 'numeric' })
}
const dateTime = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : localeDate(d, locale.value, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ---- tests taken per day: a stacked bar per day, IELTS then Multilevel, in the chart series order ----
const hovered = ref<number | null>(null)
const peak = computed(() => Math.max(5, ...(data.value?.examActivity ?? []).map(d => d.ielts + d.cefr)))
const top = computed(() => Math.ceil(peak.value / 5) * 5)
const xTicks = computed(() => {
  const list = data.value?.examActivity ?? []
  if (!list.length) return []
  const idx = [...new Set([0, Math.floor(list.length / 3), Math.floor(list.length * 2 / 3), list.length - 1])]
  return idx.map(i => ({ i, label: shortDate(list[i]!.day) }))
})
const totals = computed(() => (data.value?.examActivity ?? []).reduce((a, d) => ({ ielts: a.ielts + d.ielts, cefr: a.cefr + d.cefr }), { ielts: 0, cefr: 0 }))

const statusLabel = (s: string) => t(`adash.status.${s}`)
const statusColor = (s: string) => (s === 'Ongoing' ? 'error' as const : 'neutral' as const)

const shortcuts = computed(() => [
  { label: t('adash.newTest'), description: t('adash.newTestText'), icon: 'i-lucide-file-plus-2', to: '/builder' },
  { label: t('nav.live'), description: t('adash.liveText'), icon: 'i-lucide-radio', to: '/admin/live' },
  { label: t('panel.users'), description: t('adash.usersText'), icon: 'i-lucide-users', to: '/admin/users' },
  { label: t('panel.marking'), description: t('adash.markingText', { n: k.value?.pendingMarking ?? 0 }), icon: 'i-lucide-pen-line', to: '/marking' }
])
const levelMax = computed(() => Math.max(1, ...(data.value?.cefrDistribution ?? []).map(l => l.count)))
</script>

<template>
  <AppPage
    :title="t('panel.dashboard')"
    icon="i-lucide-layout-dashboard"
  >
    <template #actions>
      <UButton
        to="/admin/live"
        :label="t('nav.live')"
        icon="i-lucide-radio"
        color="neutral"
        variant="outline"
        class="hidden sm:inline-flex"
      />
      <UButton
        to="/builder"
        :label="t('adash.newTest')"
        icon="i-lucide-plus"
      />
    </template>

    <div class="flex flex-col gap-6 w-full max-w-6xl">
      <div>
        <h2 class="text-xl sm:text-2xl font-semibold text-highlighted">
          {{ firstName ? t('tdash.hello', { name: firstName }) : t('panel.dashboard') }}
        </h2>
        <p class="text-muted mt-1">
          {{ t('adash.lead') }}
        </p>
      </div>

      <div class="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatTile
          :label="t('panel.users')"
          :value="(k?.totalUsers ?? 0).toLocaleString(locale)"
          icon="i-lucide-users"
          color="neutral"
          :hint="k ? t('adash.vsPrevious', { pct: growth(k.usersGrowthPct) }) : undefined"
          :loading="status === 'pending' && !data"
        />
        <StatTile
          :label="t('adash.catalogue')"
          :value="(k?.totalTests ?? 0).toLocaleString(locale)"
          icon="i-lucide-clipboard-check"
          color="neutral"
          :hint="k ? t('adash.vsPrevious', { pct: growth(k.testsGrowthPct) }) : undefined"
          :loading="status === 'pending' && !data"
        />
        <StatTile
          :label="t('adash.liveMocks')"
          :value="k?.liveMocksTotal ?? 0"
          icon="i-lucide-radio"
          :color="k?.liveMocksOngoing ? 'error' : 'neutral'"
          :hint="k?.liveMocksOngoing ? t('adash.ongoing', { n: k.liveMocksOngoing }) : undefined"
          :loading="status === 'pending' && !data"
        />
        <StatTile
          :label="t('nav.courses')"
          :value="k?.totalCourses ?? 0"
          icon="i-lucide-graduation-cap"
          color="neutral"
          :hint="k ? t('adash.activePacks', { n: k.activePacks }) : undefined"
          :loading="status === 'pending' && !data"
        />
      </div>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start">
        <UCard>
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 class="font-semibold text-highlighted">
                  {{ t('adash.activity') }}
                </h3>
                <ul class="flex items-center gap-4 mt-1 text-xs text-toned">
                  <li class="flex items-center gap-1.5">
                    <span class="size-2.5 rounded-sm bg-(--chart-1)" />IELTS · {{ totals.ielts }}
                  </li>
                  <li class="flex items-center gap-1.5">
                    <span class="size-2.5 rounded-sm bg-(--chart-2)" />Multilevel · {{ totals.cefr }}
                  </li>
                </ul>
              </div>
              <USelect
                v-model="days"
                :items="dayOptions"
                size="sm"
                class="w-40"
              />
            </div>
          </template>
          <USkeleton
            v-if="status === 'pending' && !data"
            class="h-56"
          />
          <div
            v-else
            class="flex gap-2 h-56"
            role="img"
            :aria-label="t('adash.activity')"
          >
            <div class="flex flex-col justify-between pb-6 text-[11px] text-dimmed tabular-nums text-end w-7 shrink-0">
              <span>{{ top }}</span><span>{{ top / 2 }}</span><span>0</span>
            </div>
            <div class="flex-1 flex flex-col min-w-0">
              <div class="relative flex-1 flex items-end gap-px sm:gap-0.5 border-b border-accented">
                <div class="pointer-events-none absolute inset-x-0 top-0 border-t border-default" />
                <div class="pointer-events-none absolute inset-x-0 top-1/2 border-t border-default" />
                <div
                  v-for="(bar, i) in data?.examActivity ?? []"
                  :key="bar.day"
                  class="relative flex-1 h-full flex items-end"
                  @mouseenter="hovered = i"
                  @mouseleave="hovered = null"
                >
                  <div
                    v-if="hovered === i"
                    class="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap rounded-md bg-default px-2.5 py-1.5 text-xs shadow-overlay pointer-events-none"
                  >
                    <p class="font-semibold text-highlighted">
                      {{ shortDate(bar.day) }}
                    </p>
                    <p class="text-toned tabular-nums">
                      IELTS {{ bar.ielts }} · Multilevel {{ bar.cefr }}
                    </p>
                  </div>
                  <div
                    class="w-full flex flex-col-reverse gap-px rounded-t-[4px] overflow-hidden transition-opacity"
                    :class="hovered !== null && hovered !== i ? 'opacity-50' : ''"
                    :style="{ height: `${bar.ielts + bar.cefr ? Math.max(3, (bar.ielts + bar.cefr) / top * 100) : 0}%` }"
                  >
                    <div
                      class="bg-(--chart-1)"
                      :style="{ flex: bar.ielts }"
                    />
                    <div
                      class="bg-(--chart-2)"
                      :style="{ flex: bar.cefr }"
                    />
                  </div>
                </div>
              </div>
              <div class="relative h-6 text-[11px] text-muted">
                <span
                  v-for="x in xTicks"
                  :key="x.i"
                  class="absolute top-2 -translate-x-1/2 whitespace-nowrap first:translate-x-0 last:-translate-x-full"
                  :style="{ left: `${(x.i + 0.5) / (data?.examActivity.length || 1) * 100}%` }"
                >{{ x.label }}</span>
              </div>
            </div>
          </div>
        </UCard>

        <UCard :ui="{ body: 'p-2 sm:p-2' }">
          <template #header>
            <h3 class="font-semibold text-highlighted">
              {{ t('adash.goTo') }}
            </h3>
          </template>
          <ul>
            <li
              v-for="s in shortcuts"
              :key="s.to"
            >
              <NuxtLink
                :to="s.to"
                class="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-elevated/60"
              >
                <span class="grid place-items-center size-9 rounded-lg bg-elevated text-toned shrink-0">
                  <UIcon
                    :name="s.icon"
                    class="size-4.5"
                  />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-medium text-highlighted">{{ s.label }}</span>
                  <span class="block text-xs text-muted truncate">{{ s.description }}</span>
                </span>
                <UIcon
                  name="i-lucide-chevron-right"
                  class="size-4 text-dimmed"
                />
              </NuxtLink>
            </li>
          </ul>
        </UCard>
      </div>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start">
        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <h3 class="font-semibold text-highlighted">
                {{ t('adash.recent') }}
              </h3>
              <UButton
                to="/admin/live"
                :label="t('tdash.all')"
                trailing-icon="i-lucide-arrow-right"
                size="sm"
                color="neutral"
                variant="ghost"
              />
            </div>
          </template>
          <div
            v-if="data?.recentExams?.length"
            class="overflow-x-auto"
          >
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-default text-xs text-muted">
                  <th class="px-4 sm:px-5 py-2.5 text-start font-medium">
                    {{ t('adash.exam') }}
                  </th>
                  <th class="px-3 py-2.5 text-end font-medium">
                    {{ t('adash.candidates') }}
                  </th>
                  <th class="px-3 py-2.5 text-start font-medium">
                    {{ t('tp.status') }}
                  </th>
                  <th class="px-4 sm:px-5 py-2.5 text-end font-medium">
                    {{ t('tp.date') }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr
                  v-for="e in data.recentExams"
                  :key="e.id"
                  class="hover:bg-elevated/40"
                >
                  <td class="px-4 sm:px-5 py-3">
                    <NuxtLink
                      :to="e.to"
                      class="font-medium text-highlighted hover:text-primary"
                    >{{ e.title }}</NuxtLink>
                    <span class="ms-2 text-xs text-muted">{{ e.type === 'IELTS' ? 'IELTS' : 'Multilevel' }}</span>
                  </td>
                  <td class="px-3 py-3 text-end tabular-nums text-toned">
                    {{ e.candidates }}
                  </td>
                  <td class="px-3 py-3">
                    <UBadge
                      :label="statusLabel(e.status)"
                      :color="statusColor(e.status)"
                      :variant="e.status === 'Ongoing' ? 'subtle' : 'outline'"
                      size="sm"
                    />
                  </td>
                  <td class="px-4 sm:px-5 py-3 text-end text-xs text-muted whitespace-nowrap">
                    {{ dateTime(e.date) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <UEmpty
            v-else
            icon="i-lucide-radio"
            :title="t('adash.noRecent')"
            :description="t('adash.noRecentText')"
            variant="naked"
            class="py-8"
          />
        </UCard>

        <UCard>
          <template #header>
            <h3 class="font-semibold text-highlighted">
              {{ t('adash.byLevel') }}
            </h3>
            <p class="text-xs text-muted">
              {{ t('adash.byLevelText') }}
            </p>
          </template>
          <ul class="flex flex-col gap-2.5">
            <li
              v-for="l in data?.cefrDistribution ?? []"
              :key="l.level"
              class="grid grid-cols-[2.5rem_1fr_4.5rem] items-center gap-3 text-sm"
            >
              <span class="font-medium text-highlighted">{{ l.level }}</span>
              <span class="h-2 rounded-full bg-elevated overflow-hidden">
                <span
                  class="block h-full rounded-full bg-primary"
                  :style="{ width: `${l.count / levelMax * 100}%` }"
                />
              </span>
              <span class="text-end tabular-nums text-muted">{{ l.count }} · {{ l.percent }}%</span>
            </li>
          </ul>
        </UCard>
      </div>
    </div>
  </AppPage>
</template>
