<script setup lang="ts">
/**
 * Growth: how many join, come back, sit tests and pay, over the last 7, 30 or 90 days, each beside
 * the period before; where signups come from, how far they get, and how many return each week.
 */
definePageMeta({ middleware: 'admin' })
useSeoMeta({ title: 'Growth', robots: 'noindex' })

interface Pair { now: number, before: number }
interface Growth {
  days: number
  kpis: Record<'signups' | 'active' | 'attempts' | 'revenue' | 'orders' | 'buyers' | 'ai', Pair>
  daily: { day: string, signups: number, active: number, attempts: number, revenue: number }[]
  funnel: { signed: number, onboarded: number, sat: number, bot: number, paid: number }
  sources: { telegram: number, google: number, both: number, invited: number }
  cohorts: { week: string, size: number, w1: number | null, w2: number | null, w3: number | null, w4: number | null }[]
  topTests: { title: string, attempts: number, people: number }[]
  byPlan: { plan: string, orders: number, revenue: number }[]
}

const days = ref(30)
const { data, status } = await useFetch<Growth>('/api/admin/growth', { query: { days } })

const RANGES = [{ label: '7 days', value: 7 }, { label: '30 days', value: 30 }, { label: '90 days', value: 90 }]
const tiles = computed(() => {
  const k = data.value?.kpis
  if (!k) return []
  return [
    { label: 'New users', icon: 'i-lucide-user-plus', ...k.signups, fmt: (n: number) => n.toLocaleString('en-US') },
    { label: 'Active users', icon: 'i-lucide-activity', ...k.active, fmt: (n: number) => n.toLocaleString('en-US') },
    { label: 'Tests sat', icon: 'i-lucide-clipboard-check', ...k.attempts, fmt: (n: number) => n.toLocaleString('en-US') },
    { label: 'Revenue', icon: 'i-lucide-banknote', ...k.revenue, fmt: fmtUzs },
    { label: 'Paying users', icon: 'i-lucide-badge-check', ...k.buyers, fmt: (n: number) => n.toLocaleString('en-US') },
    { label: 'AI reviews', icon: 'i-lucide-sparkles', ...k.ai, fmt: (n: number) => n.toLocaleString('en-US') }
  ]
})
function delta(p: Pair) {
  if (!p.before) return p.now ? { text: 'new', up: true } : null
  const pct = Math.round(((p.now - p.before) / p.before) * 100)
  return pct ? { text: `${pct > 0 ? '+' : ''}${pct}%`, up: pct > 0 } : null
}

const labels = computed(() => data.value?.daily.map(d => d.day) ?? [])
const people = computed(() => [
  { key: 'signups', label: 'New users', values: data.value?.daily.map(d => d.signups) ?? [] },
  { key: 'active', label: 'Active users', values: data.value?.daily.map(d => d.active) ?? [] }
])

const funnel = computed(() => {
  const f = data.value?.funnel
  if (!f) return []
  const steps = [
    { label: 'Signed up', n: f.signed },
    { label: 'Finished onboarding', n: f.onboarded },
    { label: 'Sat a test', n: f.sat },
    { label: 'Joined the bot', n: f.bot },
    { label: 'Paid', n: f.paid }
  ]
  // Not every step needs the one before (some sit a test before finishing onboarding), so each is a share of signups.
  return steps.map((s, i) => ({ ...s, share: f.signed ? s.n / f.signed : 0, first: i === 0 }))
})
const sources = computed(() => {
  const s = data.value?.sources
  if (!s) return []
  const total = Math.max(1, s.telegram + s.google + s.both)
  return [
    { label: 'Telegram', n: s.telegram, share: s.telegram / total },
    { label: 'Google', n: s.google, share: s.google / total },
    { label: 'Both (merged)', n: s.both, share: s.both / total },
    { label: 'Invited by a friend', n: s.invited, share: s.invited / total }
  ]
})

// Retention: one blue ramp (--viz-q0…6 in main.css), light to dark on a light page and dark to light
// on a dark one, so a low share always recedes toward the surface.
const STOPS = [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5]
function cell(n: number | null, size: number) {
  if (n == null || !size) return null
  const share = n / size
  const step = STOPS.reduce((s, stop, i) => (share >= stop ? i : s), 0)
  return { pct: Math.round(share * 100), bg: `var(--viz-q${step})`, ink: `var(--viz-qi${step})` }
}
const weekOf = (d: string) => localeDate(d, 'en-GB', { day: 'numeric', month: 'short' })
const planTotal = computed(() => Math.max(1, ...(data.value?.byPlan ?? []).map(p => p.revenue)))
const testTop = computed(() => Math.max(1, ...(data.value?.topTests ?? []).map(t => t.attempts)))
</script>

<template>
  <AppPage
    title="Growth"
    icon="i-lucide-trending-up"
  >
    <template #actions>
      <UTabs
        v-model="days"
        :items="RANGES"
        :content="false"
        size="sm"
      />
    </template>

    <div
      class="flex flex-col gap-4 w-full max-w-6xl transition-opacity"
      :class="status === 'pending' ? 'opacity-60' : ''"
    >
      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <UCard
          v-for="t in tiles"
          :key="t.label"
          variant="subtle"
          :ui="{ body: 'p-4' }"
        >
          <div class="flex items-center gap-1.5 text-sm text-muted">
            <UIcon
              :name="t.icon"
              class="size-4"
            />{{ t.label }}
          </div>
          <p class="text-xl font-bold text-highlighted mt-1 truncate">
            {{ t.fmt(t.now) }}
          </p>
          <p class="text-xs mt-0.5 flex items-center gap-1">
            <template v-if="delta(t)">
              <UIcon
                :name="delta(t)!.up ? 'i-lucide-trending-up' : 'i-lucide-trending-down'"
                :class="delta(t)!.up ? 'text-success' : 'text-error'"
                class="size-3.5"
              />
              <span :class="delta(t)!.up ? 'text-success' : 'text-error'">{{ delta(t)!.text }}</span>
            </template>
            <span class="text-dimmed truncate">{{ delta(t) ? 'vs' : 'same as' }} {{ t.fmt(t.before) }} before</span>
          </p>
        </UCard>
      </div>

      <div class="grid lg:grid-cols-2 gap-4">
        <UCard>
          <template #header>
            <h2 class="font-semibold text-highlighted">
              New and active users
            </h2>
            <p class="text-xs text-muted">
              Per day. Active: sat at least one test that day.
            </p>
          </template>
          <VizLineChart
            v-if="data"
            :labels="labels"
            :series="people"
          />
        </UCard>
        <UCard>
          <template #header>
            <h2 class="font-semibold text-highlighted">
              Revenue
            </h2>
            <p class="text-xs text-muted">
              Paid orders per day, {{ fmtUzs(data?.kpis.revenue.now ?? 0) }} from {{ data?.kpis.orders.now ?? 0 }} orders in all.
            </p>
          </template>
          <VizBarChart
            v-if="data"
            :labels="labels"
            :values="data.daily.map(d => d.revenue)"
            label="Revenue"
            :format="fmtUzs"
            :height="220"
          />
        </UCard>
      </div>

      <div class="grid lg:grid-cols-2 gap-4">
        <UCard>
          <template #header>
            <h2 class="font-semibold text-highlighted">
              How far new users get
            </h2>
            <p class="text-xs text-muted">
              Everyone who signed up in these {{ days }} days, and what they have done since.
            </p>
          </template>
          <div class="viz grid gap-3">
            <div
              v-for="s in funnel"
              :key="s.label"
            >
              <div class="flex justify-between gap-2 text-sm">
                <span class="text-toned">{{ s.label }}</span>
                <span class="tabular-nums text-highlighted font-medium">{{ s.n.toLocaleString('en-US') }}<span
                  v-if="!s.first"
                  class="text-xs text-muted font-normal"
                > · {{ Math.round(s.share * 100) }}%</span></span>
              </div>
              <div class="h-2.5 mt-1 rounded-full bg-elevated overflow-hidden">
                <div
                  class="h-full rounded-full"
                  :style="{ width: `${Math.max(s.n ? 1.5 : 0, s.share * 100)}%`, background: 'var(--viz-s1)' }"
                />
              </div>
            </div>
          </div>
        </UCard>
        <UCard>
          <template #header>
            <h2 class="font-semibold text-highlighted">
              Where signups come from
            </h2>
            <p class="text-xs text-muted">
              How they signed in, and how many a friend invited.
            </p>
          </template>
          <div class="viz grid gap-3">
            <div
              v-for="s in sources"
              :key="s.label"
            >
              <div class="flex justify-between gap-2 text-sm">
                <span class="text-toned">{{ s.label }}</span>
                <span class="tabular-nums text-highlighted font-medium">{{ s.n.toLocaleString('en-US') }}<span class="text-xs text-muted font-normal"> · {{ Math.round(s.share * 100) }}%</span></span>
              </div>
              <div class="h-2.5 mt-1 rounded-full bg-elevated overflow-hidden">
                <div
                  class="h-full rounded-full"
                  :style="{ width: `${Math.max(s.n ? 1.5 : 0, s.share * 100)}%`, background: 'var(--viz-s1)' }"
                />
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <UCard :ui="{ body: 'overflow-x-auto' }">
        <template #header>
          <h2 class="font-semibold text-highlighted">
            Who comes back
          </h2>
          <p class="text-xs text-muted">
            Users who joined each week, and the share of them who sat a test 1, 2, 3 and 4 weeks later.
          </p>
        </template>
        <table class="viz w-full text-sm tabular-nums border-separate border-spacing-0.5">
          <thead>
            <tr class="text-xs text-muted">
              <th class="text-left font-medium pb-1">
                Joined
              </th>
              <th class="text-right font-medium pb-1 pe-2">
                Users
              </th>
              <th
                v-for="k in 4"
                :key="k"
                class="font-medium pb-1"
              >
                Week {{ k }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="c in data?.cohorts ?? []"
              :key="c.week"
            >
              <td class="whitespace-nowrap pe-2 text-toned">
                {{ weekOf(c.week) }}
              </td>
              <td class="text-right pe-2 text-highlighted">
                {{ c.size }}
              </td>
              <td
                v-for="(k, i) in [c.w1, c.w2, c.w3, c.w4]"
                :key="i"
                class="text-center rounded-sm h-8 min-w-14 text-xs font-medium"
                :style="cell(k, c.size) ? { background: cell(k, c.size)!.bg, color: cell(k, c.size)!.ink } : {}"
                :title="cell(k, c.size) ? `${k} of ${c.size} came back` : 'Not yet'"
              >
                {{ cell(k, c.size) ? `${cell(k, c.size)!.pct}%` : '' }}
              </td>
            </tr>
          </tbody>
        </table>
        <p
          v-if="!data?.cohorts.length"
          class="text-sm text-muted text-center py-6"
        >
          Nobody joined in the last eight weeks.
        </p>
      </UCard>

      <div class="grid lg:grid-cols-2 gap-4">
        <UCard>
          <template #header>
            <h2 class="font-semibold text-highlighted">
              Most sat tests
            </h2>
          </template>
          <div
            v-if="data?.topTests.length"
            class="viz grid gap-3"
          >
            <div
              v-for="t in data.topTests"
              :key="t.title"
            >
              <div class="flex justify-between gap-2 text-sm">
                <span class="text-toned truncate">{{ t.title }}</span>
                <span class="tabular-nums text-highlighted font-medium shrink-0">{{ t.attempts }}<span class="text-xs text-muted font-normal"> · {{ t.people }} people</span></span>
              </div>
              <div class="h-2.5 mt-1 rounded-full bg-elevated overflow-hidden">
                <div
                  class="h-full rounded-full"
                  :style="{ width: `${(t.attempts / testTop) * 100}%`, background: 'var(--viz-s1)' }"
                />
              </div>
            </div>
          </div>
          <p
            v-else
            class="text-sm text-muted"
          >
            No tests sat in these {{ days }} days.
          </p>
        </UCard>
        <UCard>
          <template #header>
            <h2 class="font-semibold text-highlighted">
              Revenue by plan
            </h2>
          </template>
          <div
            v-if="data?.byPlan.length"
            class="viz grid gap-3"
          >
            <div
              v-for="p in data.byPlan"
              :key="p.plan"
            >
              <div class="flex justify-between gap-2 text-sm">
                <span class="text-toned truncate">{{ p.plan }}</span>
                <span class="tabular-nums text-highlighted font-medium shrink-0">{{ fmtUzs(p.revenue) }}<span class="text-xs text-muted font-normal"> · {{ p.orders }} orders</span></span>
              </div>
              <div class="h-2.5 mt-1 rounded-full bg-elevated overflow-hidden">
                <div
                  class="h-full rounded-full"
                  :style="{ width: `${(p.revenue / planTotal) * 100}%`, background: 'var(--viz-s1)' }"
                />
              </div>
            </div>
          </div>
          <p
            v-else
            class="text-sm text-muted"
          >
            No paid orders in these {{ days }} days.
          </p>
        </UCard>
      </div>
    </div>
  </AppPage>
</template>
