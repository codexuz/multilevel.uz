<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'admin' })
useSeoMeta({ title: 'Admin Panel', robots: 'noindex' })

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

const { me } = useMe()
const days = ref(30)
const dayOptions = [
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 }
]

const { data, status } = await useFetch<DashboardData>('/api/admin/dashboard', {
  query: computed(() => ({ days: days.value }))
})

const adminName = computed(() => me.value?.name?.split(' ')[0] || 'Admin')

// Stacked bar chart layout for Exam Activity
const hoveredBar = ref<number | null>(null)
const activityMax = computed(() => {
  const vals = (data.value?.examActivity ?? []).map(d => d.ielts + d.cefr)
  const peak = Math.max(...vals, 5)
  return Math.ceil(peak / 5) * 5
})
const yTicks = computed(() => {
  const m = activityMax.value
  return [m, Math.round(m * 0.75), Math.round(m * 0.5), Math.round(m * 0.25), 0]
})
const fmtShortDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
const fmtDateTime = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

// Donut chart geometry for CEFR Level distribution
const CEFR_COLORS: Record<string, string> = {
  A1: '#60a5fa',
  A2: '#6ee7b7',
  B1: '#fcd34d',
  B2: '#818cf8',
  C1: '#a78bfa',
  C2: '#fb923c'
}
const donutRadius = 52
const donutCirc = 2 * Math.PI * donutRadius
const donutSegments = computed(() => {
  const list = data.value?.cefrDistribution ?? []
  const total = list.reduce((s, r) => s + r.count, 0)
  let offset = 0
  return list.map((item) => {
    const frac = total > 0 ? item.count / total : 0
    const len = frac * donutCirc
    const seg = {
      ...item,
      color: CEFR_COLORS[item.level] ?? '#94a3b8',
      dashArray: `${Math.max(0, len - 1.5)} ${donutCirc}`,
      dashOffset: -offset
    }
    offset += len
    return seg
  })
})

const quickActions = [
  { label: 'Manage Users', icon: 'i-lucide-user-plus', to: '/admin/users', bg: 'bg-blue-50/90 dark:bg-blue-950/30 hover:bg-blue-100/80 dark:hover:bg-blue-950/50', iconColor: 'text-blue-600 dark:text-blue-400' },
  { label: 'Create Test', icon: 'i-lucide-file-plus-2', to: '/builder', bg: 'bg-indigo-50/90 dark:bg-indigo-950/30 hover:bg-indigo-100/80 dark:hover:bg-indigo-950/50', iconColor: 'text-indigo-600 dark:text-indigo-400' },
  { label: 'Schedule Live Mock', icon: 'i-lucide-radio', to: '/admin/live', bg: 'bg-rose-50/90 dark:bg-rose-950/30 hover:bg-rose-100/80 dark:hover:bg-rose-950/50', iconColor: 'text-rose-600 dark:text-rose-400' },
  { label: 'Manage Courses', icon: 'i-lucide-book-open', to: '/admin/courses', bg: 'bg-emerald-50/90 dark:bg-emerald-950/30 hover:bg-emerald-100/80 dark:hover:bg-emerald-950/50', iconColor: 'text-emerald-600 dark:text-emerald-400' }
]
</script>

<template>
  <div class="mx-auto w-full max-w-7xl flex flex-col gap-5">
    <!-- Hero Banner -->
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#3a6ff8] via-[#5656ec] to-[#7456ec] p-6 sm:p-7 text-white shadow-lg shadow-indigo-500/15">
      <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl sm:text-3xl font-bold tracking-tight">
            Welcome back, {{ adminName }}!
          </h2>
          <p class="text-sm sm:text-base text-white/85 mt-1 max-w-xl">
            Manage your IELTS and CEFR exam &amp; LMS platform, run live mocks, author courses and track performance.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2.5 shrink-0">
          <NuxtLink
            to="/builder?exam=IELTS"
            class="px-4 py-1.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs sm:text-sm font-bold tracking-wide shadow-md transition-colors"
          >
            IELTS
          </NuxtLink>
          <NuxtLink
            to="/builder?exam=MULTILEVEL"
            class="px-4 py-1.5 rounded-full bg-[#1e40af] hover:bg-[#1d4ed8] text-white text-xs sm:text-sm font-bold tracking-wide shadow-md ring-1 ring-white/25 transition-colors"
          >
            CEFR
          </NuxtLink>
          <NuxtLink
            to="/admin/courses"
            class="px-4 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs sm:text-sm font-semibold ring-1 ring-white/25 transition-colors flex items-center gap-1.5"
          >
            <UIcon
              name="i-lucide-graduation-cap"
              class="size-4"
            />
            LMS Studio
          </NuxtLink>
        </div>
      </div>
      <!-- Subtle decorative shapes -->
      <div class="pointer-events-none absolute -right-10 -top-10 size-52 rounded-full bg-white/10 blur-2xl" />
      <div class="pointer-events-none absolute right-24 -bottom-16 size-44 rounded-full bg-sky-300/20 blur-2xl" />
    </div>

    <!-- 4 KPI Cards Row -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <UCard :ui="{ body: 'p-4 sm:p-5 flex items-center gap-4' }">
        <div class="size-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 grid place-items-center shrink-0">
          <UIcon
            name="i-lucide-users"
            class="size-6"
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-muted">
            Total Users
          </p>
          <div class="flex items-baseline gap-2 mt-0.5 flex-wrap">
            <span class="text-2xl font-bold text-highlighted tabular-nums">{{ (data?.kpis.totalUsers ?? 0).toLocaleString() }}</span>
            <span
              class="text-xs font-semibold px-1.5 py-0.5 rounded-md"
              :class="(data?.kpis.usersGrowthPct ?? 0) >= 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-50 text-rose-700'"
            >
              {{ (data?.kpis.usersGrowthPct ?? 0) >= 0 ? '↑ +' : '↓ ' }}{{ data?.kpis.usersGrowthPct ?? 0 }}%
            </span>
          </div>
          <p class="text-[11px] text-dimmed mt-0.5">
            vs. last 30 days
          </p>
        </div>
      </UCard>

      <UCard :ui="{ body: 'p-4 sm:p-5 flex items-center gap-4' }">
        <div class="size-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 grid place-items-center shrink-0">
          <UIcon
            name="i-lucide-file-text"
            class="size-6"
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-muted">
            Total Tests
          </p>
          <div class="flex items-baseline gap-2 mt-0.5 flex-wrap">
            <span class="text-2xl font-bold text-highlighted tabular-nums">{{ (data?.kpis.totalTests ?? 0).toLocaleString() }}</span>
            <span class="text-xs font-semibold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              ↑ +{{ data?.kpis.testsGrowthPct ?? 0 }}%
            </span>
          </div>
          <p class="text-[11px] text-dimmed mt-0.5">
            {{ data?.kpis.pendingMarking ?? 0 }} awaiting marking
          </p>
        </div>
      </UCard>

      <UCard :ui="{ body: 'p-4 sm:p-5 flex items-center gap-4' }">
        <div class="size-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 grid place-items-center shrink-0">
          <UIcon
            name="i-lucide-radio"
            class="size-6"
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-muted">
            Live Mock Sessions
          </p>
          <div class="flex items-baseline gap-2 mt-0.5 flex-wrap">
            <span class="text-2xl font-bold text-highlighted tabular-nums">{{ data?.kpis.liveMocksTotal ?? 0 }}</span>
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
              • {{ data?.kpis.liveMocksOngoing ?? 0 }} ongoing
            </span>
          </div>
          <p class="text-[11px] text-dimmed mt-0.5">
            Scheduled &amp; completed
          </p>
        </div>
      </UCard>

      <UCard :ui="{ body: 'p-4 sm:p-5 flex items-center gap-4' }">
        <div class="size-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0">
          <UIcon
            name="i-lucide-layers"
            class="size-6"
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-muted">
            Courses &amp; Packs
          </p>
          <div class="flex items-baseline gap-2 mt-0.5 flex-wrap">
            <span class="text-2xl font-bold text-highlighted tabular-nums">{{ data?.kpis.totalCourses ?? 0 }}</span>
            <span class="text-xs font-semibold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {{ data?.kpis.activePacks ?? 0 }} active packs
            </span>
          </div>
          <p class="text-[11px] text-dimmed mt-0.5">
            LMS courses &amp; tariffs
          </p>
        </div>
      </UCard>
    </div>

    <!-- Middle Row: Exam Activity Chart (2/3) + Quick Actions (1/3) -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <UCard
        class="lg:col-span-2"
        :ui="{ body: 'p-5 flex flex-col gap-4' }"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="font-bold text-highlighted text-base">
              Exam Activity
            </h3>
            <div class="flex items-center gap-4 mt-1 text-xs text-muted">
              <span class="flex items-center gap-1.5">
                <span class="size-2.5 rounded-sm bg-[#3b82f6]" /> IELTS
              </span>
              <span class="flex items-center gap-1.5">
                <span class="size-2.5 rounded-sm bg-[#a78bfa]" /> CEFR
              </span>
            </div>
          </div>
          <USelect
            v-model="days"
            :items="dayOptions"
            size="sm"
            class="w-36"
          />
        </div>

        <USkeleton
          v-if="status === 'pending' && !data"
          class="h-56 w-full rounded-xl"
        />
        <div
          v-else
          class="relative h-56 flex items-end gap-2 pt-4"
        >
          <!-- Y-Axis Labels -->
          <div class="flex flex-col justify-between h-full pb-6 text-[11px] text-dimmed tabular-nums pr-1 shrink-0">
            <span
              v-for="tick in yTicks"
              :key="tick"
            >{{ tick }}</span>
          </div>

          <!-- Bars -->
          <div class="flex-1 h-full flex flex-col">
            <div class="flex-1 flex items-end gap-1 sm:gap-1.5 border-b border-default relative">
              <!-- Horizontal Gridlines -->
              <div class="pointer-events-none absolute inset-0 flex flex-col justify-between">
                <div
                  v-for="n in 4"
                  :key="n"
                  class="border-t border-dashed border-default/60 w-full"
                />
                <div />
              </div>

              <div
                v-for="(bar, idx) in data?.examActivity ?? []"
                :key="bar.day"
                class="relative flex-1 h-full flex flex-col justify-end items-center group cursor-pointer z-10"
                @mouseenter="hoveredBar = idx"
                @mouseleave="hoveredBar = null"
              >
                <!-- Hover Tooltip -->
                <div
                  v-if="hoveredBar === idx"
                  class="absolute -top-2 -translate-y-full z-20 whitespace-nowrap rounded-lg bg-[#151a34] text-white text-[11px] px-2.5 py-1.5 shadow-lg pointer-events-none"
                >
                  <p class="font-semibold">
                    {{ fmtShortDate(bar.day) }}
                  </p>
                  <p class="text-blue-300">
                    IELTS: {{ bar.ielts }}
                  </p>
                  <p class="text-violet-300">
                    CEFR: {{ bar.cefr }}
                  </p>
                </div>

                <div
                  class="w-full max-w-4 flex flex-col justify-end rounded-t overflow-hidden transition-opacity group-hover:opacity-90"
                  :style="{ height: `${Math.max(bar.ielts + bar.cefr > 0 ? 4 : 0, Math.round(((bar.ielts + bar.cefr) / activityMax) * 100))}%` }"
                >
                  <div
                    class="w-full bg-[#3b82f6]"
                    :style="{ flex: bar.ielts || 0 }"
                  />
                  <div
                    class="w-full bg-[#a78bfa]"
                    :style="{ flex: bar.cefr || 0 }"
                  />
                </div>
              </div>
            </div>
            <!-- X-Axis Sparse Labels -->
            <div class="flex justify-between pt-2 text-[11px] text-dimmed">
              <span v-if="data?.examActivity.length">{{ fmtShortDate(data.examActivity[0]!.day) }}</span>
              <span v-if="(data?.examActivity.length ?? 0) > 4">{{ fmtShortDate(data!.examActivity[Math.floor(data!.examActivity.length / 3)]!.day) }}</span>
              <span v-if="(data?.examActivity.length ?? 0) > 4">{{ fmtShortDate(data!.examActivity[Math.floor((data!.examActivity.length * 2) / 3)]!.day) }}</span>
              <span v-if="data?.examActivity.length">{{ fmtShortDate(data.examActivity[data.examActivity.length - 1]!.day) }}</span>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Quick Actions -->
      <UCard :ui="{ body: 'p-5 flex flex-col gap-4' }">
        <h3 class="font-bold text-highlighted text-base">
          Quick Actions
        </h3>
        <div class="grid grid-cols-2 gap-3 flex-1">
          <NuxtLink
            v-for="a in quickActions"
            :key="a.label"
            :to="a.to"
            class="rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2.5 transition-colors border border-transparent hover:border-default"
            :class="a.bg"
          >
            <UIcon
              :name="a.icon"
              class="size-6"
              :class="a.iconColor"
            />
            <span class="text-xs sm:text-sm font-semibold text-highlighted leading-tight">{{ a.label }}</span>
          </NuxtLink>
        </div>
      </UCard>
    </div>

    <!-- Bottom Row: Recent Exams (2/3) + User Distribution by Level (1/3) -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <UCard
        class="lg:col-span-2"
        :ui="{ body: 'p-5 flex flex-col gap-4' }"
      >
        <div class="flex items-center justify-between gap-2">
          <h3 class="font-bold text-highlighted text-base">
            Recent Exams
          </h3>
          <UButton
            to="/admin/live"
            label="View All"
            trailing-icon="i-lucide-arrow-right"
            size="xs"
            color="primary"
            variant="ghost"
          />
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-default text-left text-xs font-semibold text-muted">
                <th class="py-2.5 pe-3">
                  #
                </th>
                <th class="py-2.5 pe-3">
                  Exam
                </th>
                <th class="py-2.5 pe-3">
                  Type
                </th>
                <th class="py-2.5 pe-3">
                  Candidates
                </th>
                <th class="py-2.5 pe-3">
                  Status
                </th>
                <th class="py-2.5">
                  Date
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default/60">
              <tr
                v-for="(exam, idx) in data?.recentExams ?? []"
                :key="exam.id"
                class="hover:bg-elevated/40 transition-colors"
              >
                <td class="py-3 pe-3 text-muted tabular-nums">
                  {{ idx + 1 }}
                </td>
                <td class="py-3 pe-3 font-medium text-highlighted">
                  <NuxtLink
                    :to="exam.to"
                    class="hover:text-primary transition-colors"
                  >
                    {{ exam.title }}
                  </NuxtLink>
                </td>
                <td class="py-3 pe-3">
                  <UBadge
                    :label="exam.type"
                    :color="exam.type === 'IELTS' ? 'error' : 'primary'"
                    variant="subtle"
                    size="sm"
                  />
                </td>
                <td class="py-3 pe-3 tabular-nums font-medium">
                  {{ exam.candidates }}
                </td>
                <td class="py-3 pe-3">
                  <UBadge
                    :label="exam.status"
                    :color="exam.status === 'Ongoing' ? 'error' : exam.status === 'Finished' || exam.status === 'Published' ? 'success' : 'info'"
                    variant="soft"
                    size="sm"
                  />
                </td>
                <td class="py-3 text-xs text-muted whitespace-nowrap">
                  {{ fmtDateTime(exam.date) }}
                </td>
              </tr>
              <tr v-if="!(data?.recentExams?.length)">
                <td
                  colspan="6"
                  class="py-8 text-center text-sm text-muted"
                >
                  No exams scheduled yet. Create a test or live mock to get started.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <!-- User Distribution by Level (CEFR) Donut -->
      <UCard :ui="{ body: 'p-5 flex flex-col gap-4' }">
        <h3 class="font-bold text-highlighted text-base">
          User Distribution by Level (CEFR)
        </h3>

        <div class="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-5 my-auto">
          <div class="relative size-36 shrink-0">
            <svg
              viewBox="0 0 140 140"
              class="size-full -rotate-90"
            >
              <circle
                cx="70"
                cy="70"
                :r="donutRadius"
                fill="none"
                stroke="currentColor"
                class="text-elevated"
                stroke-width="20"
              />
              <circle
                v-for="seg in donutSegments"
                :key="seg.level"
                cx="70"
                cy="70"
                :r="donutRadius"
                fill="none"
                :stroke="seg.color"
                stroke-width="20"
                :stroke-dasharray="seg.dashArray"
                :stroke-dashoffset="seg.dashOffset"
              />
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span class="text-xl font-bold text-highlighted tabular-nums leading-none">{{ (data?.kpis.totalUsers ?? 0).toLocaleString() }}</span>
              <span class="text-[11px] text-muted mt-1">Users</span>
            </div>
          </div>

          <ul class="flex-1 w-full space-y-2 text-xs">
            <li
              v-for="seg in donutSegments"
              :key="seg.level"
              class="flex items-center justify-between gap-2"
            >
              <span class="flex items-center gap-2 font-medium text-highlighted">
                <span
                  class="size-2.5 rounded-full shrink-0"
                  :style="{ backgroundColor: seg.color }"
                />
                {{ seg.level }}
              </span>
              <span class="tabular-nums text-toned font-semibold">
                {{ seg.percent }}% <span class="text-dimmed font-normal">({{ seg.count.toLocaleString() }})</span>
              </span>
            </li>
          </ul>
        </div>
      </UCard>
    </div>
  </div>
</template>
