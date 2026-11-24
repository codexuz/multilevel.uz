<script setup lang="ts">
/**
 * The Teacher panel's home: this week at a glance (classes, students, online classes, scripts to
 * mark), today's and the next online classes, my classes with how far each has got, the latest
 * results, and each class's average over the last four weeks.
 */
definePageMeta({ middleware: 'teacher' })

interface TeacherDashboard {
  kpis: {
    myGroups: number
    groupsThisWeek: number
    totalStudents: number
    studentsNewThisWeek: number
    classesThisWeek: number
    avgTestScore: number
    scoreDelta: number
    coursesCount: number
    pendingMarking: number
  }
  groups: Array<{ id: string, name: string, level: string | null, joinCode: string, students: number, assignments: number, progress: number }>
  todaysClasses: Array<{ id: string, title: string, subtitle: string, startsAt: string, endsAt: string, durationMinutes: number, meetUrl: string | null, isToday: boolean, isLiveNow: boolean }>
  recentResults: Array<{ id: string, kind: 'EXAM' | 'EXERCISE', studentName: string, studentInitials: string, avatarUrl: string | null, title: string, scoreDisplay: string, badge: string, submittedAt: string, to: string }>
  performanceGroups: Array<{ id: string, name: string }>
  groupPerformance: Array<{ label: string, values: Array<{ groupId: string, groupName: string, value: number }> }>
}

const { t, locale } = useI18n()
const { me } = useMe()
useSeoMeta({ title: () => t('panel.dashboard'), robots: 'noindex' })
const { data, status } = await useFetch<TeacherDashboard>('/api/teacher/dashboard')
const k = computed(() => data.value?.kpis)

const firstName = computed(() => (me.value?.name || '').split(/\s+/)[0] || '')
const time = (iso: string) => localeDate(iso, locale.value, { hour: '2-digit', minute: '2-digit' })
const day = (iso: string) => localeDate(iso, locale.value, { weekday: 'short', day: 'numeric', month: 'short' })
const ago = (iso: string) => localeDate(iso, locale.value, { day: 'numeric', month: 'short' })

/** The server's few English words, in the viewer's language. */
const score = (s: string) => (s === 'Pending' ? t('tdash.toMark') : s)
const badge = (b: string) => (b === 'Passed' ? t('tdash.passed') : b === 'LMS' ? t('nav.courses') : b === 'CEFR' ? 'Multilevel' : b)
const weekLabel = (label: string, i: number) => (/^Week \d+$/.test(label) ? t('tdash.week', { n: i + 1 }) : label)

// ---- the class averages chart: series in a fixed order, one colour per class ----
const SERIES = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)']
const seriesOf = (groupId: string) => SERIES[(data.value?.performanceGroups ?? []).findIndex(g => g.id === groupId)] ?? 'var(--ui-text-dimmed)'
const hovered = ref<string | null>(null)
const asTable = ref(false)
</script>

<template>
  <AppPage
    :title="t('panel.dashboard')"
    icon="i-lucide-layout-dashboard"
  >
    <template #actions>
      <UButton
        to="/classes?new=1"
        :label="t('tdash.newClass')"
        icon="i-lucide-users"
        color="neutral"
        variant="outline"
        class="hidden sm:inline-flex"
      />
      <UButton
        to="/teacher/courses"
        :label="t('courses.new')"
        icon="i-lucide-plus"
      />
    </template>

    <div class="flex flex-col gap-6 w-full max-w-6xl">
      <div>
        <h2 class="text-xl sm:text-2xl font-semibold text-highlighted">
          {{ firstName ? t('tdash.hello', { name: firstName }) : t('panel.dashboard') }}
        </h2>
        <p class="text-muted mt-1">
          {{ t('tdash.lead') }}
        </p>
      </div>

      <div class="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatTile
          :label="t('panel.myClasses')"
          :value="k?.myGroups ?? 0"
          icon="i-lucide-users"
          color="neutral"
          :loading="status === 'pending' && !data"
        />
        <StatTile
          :label="t('panel.students')"
          :value="k?.totalStudents ?? 0"
          icon="i-lucide-user-round"
          color="neutral"
          :hint="k?.studentsNewThisWeek ? t('tdash.newThisWeek', { n: k.studentsNewThisWeek }) : undefined"
          :loading="status === 'pending' && !data"
        />
        <StatTile
          :label="t('tdash.onlineThisWeek')"
          :value="k?.classesThisWeek ?? 0"
          icon="i-lucide-video"
          color="neutral"
          :loading="status === 'pending' && !data"
        />
        <StatTile
          :label="t('tdash.toMarkTitle')"
          :value="k?.pendingMarking ?? 0"
          icon="i-lucide-pen-line"
          :color="k?.pendingMarking ? 'warning' : 'neutral'"
          :loading="status === 'pending' && !data"
        />
      </div>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <h3 class="font-semibold text-highlighted">
                {{ t('tdash.onlineNext') }}
              </h3>
              <UButton
                to="/teacher/classes"
                :label="t('tdash.allOnline')"
                trailing-icon="i-lucide-arrow-right"
                size="sm"
                color="neutral"
                variant="ghost"
              />
            </div>
          </template>
          <ul
            v-if="data?.todaysClasses?.length"
            class="-my-2 divide-y divide-default"
          >
            <li
              v-for="c in data.todaysClasses.slice(0, 4)"
              :key="c.id"
              class="flex items-center gap-3 py-3"
            >
              <div class="w-16 shrink-0 text-sm tabular-nums">
                <p class="font-semibold text-highlighted">
                  {{ time(c.startsAt) }}
                </p>
                <p class="text-xs text-muted">
                  {{ c.isToday ? t('tdash.today') : day(c.startsAt) }}
                </p>
              </div>
              <div class="min-w-0 flex-1">
                <p class="font-medium text-highlighted truncate flex items-center gap-2">
                  {{ c.title }}
                  <UBadge
                    v-if="c.isLiveNow"
                    :label="t('online.live')"
                    color="error"
                    variant="subtle"
                    size="sm"
                  />
                </p>
                <p class="text-sm text-muted truncate">
                  {{ c.subtitle === 'Online Class' ? t('online.defaultTitle') : c.subtitle }} · {{ t('online.minutes', { n: c.durationMinutes }) }}
                </p>
              </div>
              <UButton
                v-if="c.meetUrl"
                :href="c.meetUrl"
                target="_blank"
                rel="noopener"
                :label="t('online.join')"
                icon="i-logos-google-meet"
                size="sm"
                :color="c.isLiveNow ? 'primary' : 'neutral'"
                :variant="c.isLiveNow ? 'solid' : 'outline'"
              />
            </li>
          </ul>
          <UEmpty
            v-else
            icon="i-lucide-video"
            :title="t('online.noneComing')"
            :description="t('tdash.noOnlineText')"
            :actions="[{ label: t('online.schedule'), icon: 'i-lucide-plus', to: '/teacher/classes', color: 'neutral', variant: 'outline' }]"
            variant="naked"
          />
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <h3 class="font-semibold text-highlighted">
                {{ t('panel.myClasses') }}
              </h3>
              <UButton
                to="/classes"
                :label="t('tdash.all')"
                trailing-icon="i-lucide-arrow-right"
                size="sm"
                color="neutral"
                variant="ghost"
              />
            </div>
          </template>
          <ul
            v-if="data?.groups?.length"
            class="-my-1 flex flex-col"
          >
            <li
              v-for="g in data.groups.slice(0, 5)"
              :key="g.id"
            >
              <NuxtLink
                :to="`/classes/${g.id}`"
                class="flex items-center gap-3 rounded-lg -mx-2 px-2 py-2.5 hover:bg-elevated/60"
              >
                <div class="min-w-0 flex-1">
                  <p class="font-medium text-highlighted truncate">
                    {{ g.name }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ t('tdash.studentsN', { n: g.students }, g.students) }}<template v-if="g.level">
                      · {{ g.level }}
                    </template>
                  </p>
                </div>
                <div class="w-20 shrink-0">
                  <p class="text-xs text-muted text-end tabular-nums">
                    {{ g.progress }}%
                  </p>
                  <UProgress
                    :model-value="g.progress"
                    size="xs"
                    class="mt-1"
                  />
                </div>
              </NuxtLink>
            </li>
          </ul>
          <UEmpty
            v-else
            icon="i-lucide-users"
            :title="t('tdash.noClasses')"
            :description="t('tdash.noClassesText')"
            :actions="[{ label: t('tdash.newClass'), icon: 'i-lucide-plus', to: '/classes?new=1' }]"
            variant="naked"
          />
        </UCard>
      </div>

      <div class="grid gap-6 lg:grid-cols-2 items-start">
        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <h3 class="font-semibold text-highlighted">
                {{ t('tdash.latestResults') }}
              </h3>
              <UButton
                to="/teacher/results"
                :label="t('tdash.all')"
                trailing-icon="i-lucide-arrow-right"
                size="sm"
                color="neutral"
                variant="ghost"
              />
            </div>
          </template>
          <ul
            v-if="data?.recentResults?.length"
            class="divide-y divide-default"
          >
            <li
              v-for="r in data.recentResults.slice(0, 6)"
              :key="r.id"
            >
              <NuxtLink
                :to="r.to"
                class="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-elevated/50"
              >
                <UAvatar
                  :src="r.avatarUrl ?? undefined"
                  :text="r.studentInitials"
                  size="sm"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-highlighted truncate">
                    {{ r.studentName }}
                  </p>
                  <p class="text-xs text-muted truncate">
                    {{ r.title }} · {{ ago(r.submittedAt) }}
                  </p>
                </div>
                <div class="text-end shrink-0">
                  <p class="text-sm font-semibold tabular-nums text-highlighted">
                    {{ score(r.scoreDisplay) }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ badge(r.badge) }}
                  </p>
                </div>
              </NuxtLink>
            </li>
          </ul>
          <UEmpty
            v-else
            icon="i-lucide-chart-column"
            :title="t('tdash.noResults')"
            :description="t('tdash.noResultsText')"
            variant="naked"
            class="py-8"
          />
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <div>
                <h3 class="font-semibold text-highlighted">
                  {{ t('tdash.averages') }}
                </h3>
                <p class="text-xs text-muted">
                  {{ t('tdash.averagesText') }}
                </p>
              </div>
              <UButton
                v-if="data?.performanceGroups?.length"
                :label="asTable ? t('tdash.asChart') : t('tdash.asTable')"
                :icon="asTable ? 'i-lucide-chart-column' : 'i-lucide-table'"
                size="sm"
                color="neutral"
                variant="ghost"
                @click="asTable = !asTable"
              />
            </div>
          </template>

          <template v-if="data?.performanceGroups?.length">
            <ul class="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-xs text-toned">
              <li
                v-for="g in data.performanceGroups"
                :key="g.id"
                class="flex items-center gap-1.5"
              >
                <span
                  class="size-2.5 rounded-sm"
                  :style="{ background: seriesOf(g.id) }"
                />{{ g.name }}
              </li>
            </ul>

            <table
              v-if="asTable"
              class="w-full text-sm tabular-nums"
            >
              <thead>
                <tr class="text-xs text-muted border-b border-default">
                  <th class="py-2 text-start font-medium">
                    {{ t('panel.myClasses') }}
                  </th>
                  <th
                    v-for="(wk, i) in data.groupPerformance"
                    :key="wk.label"
                    class="py-2 text-end font-medium"
                  >
                    {{ weekLabel(wk.label, i) }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr
                  v-for="g in data.performanceGroups"
                  :key="g.id"
                >
                  <td class="py-2 text-highlighted">
                    {{ g.name }}
                  </td>
                  <td
                    v-for="wk in data.groupPerformance"
                    :key="wk.label"
                    class="py-2 text-end text-toned"
                  >
                    {{ wk.values.find(v => v.groupId === g.id)?.value ?? 0 }}%
                  </td>
                </tr>
              </tbody>
            </table>

            <div
              v-else
              class="flex gap-2 h-48"
              role="img"
              :aria-label="t('tdash.averages')"
            >
              <div class="flex flex-col justify-between pb-6 text-[11px] text-dimmed tabular-nums text-end w-8 shrink-0">
                <span>100%</span><span>50%</span><span>0%</span>
              </div>
              <div class="flex-1 flex flex-col min-w-0">
                <div class="relative flex-1 grid grid-cols-4 gap-3 items-end border-b border-accented">
                  <div class="pointer-events-none absolute inset-x-0 top-0 border-t border-default" />
                  <div class="pointer-events-none absolute inset-x-0 top-1/2 border-t border-default" />
                  <div
                    v-for="wk in data.groupPerformance"
                    :key="wk.label"
                    class="relative h-full flex items-end justify-center gap-0.5"
                  >
                    <div
                      v-for="v in wk.values"
                      :key="v.groupId"
                      class="relative flex-1 max-w-4 h-full flex items-end"
                      @mouseenter="hovered = `${wk.label}|${v.groupId}`"
                      @mouseleave="hovered = null"
                    >
                      <div
                        v-if="hovered === `${wk.label}|${v.groupId}`"
                        class="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap rounded-md bg-default px-2 py-1 text-xs text-highlighted shadow-overlay pointer-events-none"
                      >
                        {{ v.groupName }}: <span class="tabular-nums font-semibold">{{ v.value }}%</span>
                      </div>
                      <div
                        class="w-full rounded-t-[4px] transition-[height] duration-300"
                        :style="{ height: `${Math.max(v.value > 0 ? 3 : 1, v.value)}%`, background: seriesOf(v.groupId), opacity: hovered && hovered !== `${wk.label}|${v.groupId}` ? 0.45 : 1 }"
                      />
                    </div>
                  </div>
                </div>
                <div class="grid grid-cols-4 gap-3 pt-2 text-[11px] text-muted text-center">
                  <span
                    v-for="(wk, i) in data.groupPerformance"
                    :key="wk.label"
                  >{{ weekLabel(wk.label, i) }}</span>
                </div>
              </div>
            </div>
          </template>
          <UEmpty
            v-else
            icon="i-lucide-chart-column"
            :title="t('tdash.noAverages')"
            :description="t('tdash.noAveragesText')"
            variant="naked"
          />
        </UCard>
      </div>
    </div>
  </AppPage>
</template>
