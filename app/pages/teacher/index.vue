<script setup lang="ts">
definePageMeta({ middleware: 'teacher', layout: 'teacher' })
useSeoMeta({ title: 'Teacher Dashboard', robots: 'noindex' })

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

const { me, refresh: refreshMe } = useMe()
const router = useRouter()
const toast = useToast()

const { data, refresh } = await useFetch<TeacherDashboard>('/api/teacher/dashboard')
const teacherName = computed(() => me.value?.name || 'Teacher')

// Quick Create Group modal
const creatingGroup = ref(false)
const savingGroup = ref(false)
const groupForm = reactive({ name: '', level: 'B2' })
const levelOptions = ['A1', 'A2', 'B1', 'B2', 'C1', 'IELTS', 'CEFR']

async function createGroup() {
  if (!groupForm.name.trim()) return
  savingGroup.value = true
  try {
    const g = await $fetch<{ id: string }>('/api/classes', { method: 'POST', body: { name: groupForm.name, level: groupForm.level } })
    creatingGroup.value = false
    groupForm.name = ''
    await refreshMe()
    await refresh()
    toast.add({ title: 'Group created', color: 'success' })
    await router.push(`/classes/${g.id}`)
  } catch (e) {
    toast.add({ title: 'Could not create group', description: errorMessage(e), color: 'error' })
  } finally {
    savingGroup.value = false
  }
}

const fmtTimeRange = (startIso: string, endIso: string) => {
  const s = new Date(startIso)
  const e = new Date(endIso)
  const f = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${f(s)} – ${f(e)}`
}

const GROUP_BAR_COLORS = ['#3b82f6', '#8b5cf6', '#34d399', '#fbbf24']
const GROUP_ICON_STYLES = [
  'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
  'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400'
]
const BAR_BG = ['bg-blue-500', 'bg-sky-400', 'bg-emerald-500', 'bg-purple-500']

const hoveredCell = ref<string | null>(null)
</script>

<template>
  <div class="mx-auto w-full max-w-7xl flex flex-col gap-5">
    <!-- Hero Banner -->
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#3a6ff8] via-[#5656ec] to-[#7456ec] p-6 sm:p-7 text-white shadow-lg shadow-indigo-500/15">
      <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl sm:text-3xl font-bold tracking-tight">
            Hello, {{ teacherName }}!
          </h2>
          <p class="text-sm sm:text-base text-white/85 mt-1">
            Here's your teaching overview for this week across your groups, LMS courses and live classes.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2.5 shrink-0">
          <span class="px-4 py-1.5 rounded-full bg-rose-500 text-white text-xs sm:text-sm font-bold tracking-wide shadow-md">
            IELTS
          </span>
          <span class="px-4 py-1.5 rounded-full bg-[#1e40af] text-white text-xs sm:text-sm font-bold tracking-wide shadow-md ring-1 ring-white/25">
            CEFR
          </span>
          <NuxtLink
            to="/teacher/courses"
            class="px-4 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs sm:text-sm font-semibold ring-1 ring-white/25 transition-colors flex items-center gap-1.5"
          >
            <UIcon
              name="i-lucide-book-open"
              class="size-4"
            />
            Course Studio ({{ data?.kpis.coursesCount ?? 0 }})
          </NuxtLink>
        </div>
      </div>
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
            My Groups
          </p>
          <div class="flex items-baseline gap-2 mt-0.5">
            <span class="text-2xl font-bold text-highlighted tabular-nums">{{ data?.kpis.myGroups ?? 0 }}</span>
            <span
              v-if="data?.kpis.groupsThisWeek"
              class="text-xs font-semibold text-emerald-600 dark:text-emerald-400"
            >↑ +{{ data.kpis.groupsThisWeek }}</span>
          </div>
          <p class="text-[11px] text-dimmed">
            Active student groups
          </p>
        </div>
      </UCard>

      <UCard :ui="{ body: 'p-4 sm:p-5 flex items-center gap-4' }">
        <div class="size-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 grid place-items-center shrink-0">
          <UIcon
            name="i-lucide-user-round"
            class="size-6"
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-muted">
            Students
          </p>
          <div class="flex items-baseline gap-2 mt-0.5">
            <span class="text-2xl font-bold text-highlighted tabular-nums">{{ data?.kpis.totalStudents ?? 0 }}</span>
            <span class="text-xs font-semibold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              ↑ +{{ data?.kpis.studentsNewThisWeek ?? 0 }}
            </span>
          </div>
          <p class="text-[11px] text-dimmed">
            Joined this week
          </p>
        </div>
      </UCard>

      <UCard :ui="{ body: 'p-4 sm:p-5 flex items-center gap-4' }">
        <div class="size-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 grid place-items-center shrink-0">
          <UIcon
            name="i-lucide-calendar-clock"
            class="size-6"
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-muted">
            Classes (This Week)
          </p>
          <div class="flex items-center gap-3 mt-0.5">
            <span class="text-2xl font-bold text-highlighted tabular-nums">{{ data?.kpis.classesThisWeek ?? 0 }}</span>
            <UProgress
              :model-value="Math.min(100, (data?.kpis.classesThisWeek ?? 0) * 15)"
              size="xs"
              class="flex-1"
            />
          </div>
          <p class="text-[11px] text-dimmed">
            Google Meet sessions
          </p>
        </div>
      </UCard>

      <UCard :ui="{ body: 'p-4 sm:p-5 flex items-center gap-4' }">
        <div class="size-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 grid place-items-center shrink-0">
          <UIcon
            name="i-lucide-award"
            class="size-6"
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-muted">
            Avg. Test Score
          </p>
          <div class="flex items-baseline gap-2 mt-0.5">
            <span class="text-2xl font-bold text-highlighted tabular-nums">{{ data?.kpis.avgTestScore ?? 0 }}%</span>
            <span
              v-if="data?.kpis.scoreDelta"
              class="text-xs font-semibold px-1.5 py-0.5 rounded-md"
              :class="data.kpis.scoreDelta >= 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-50 text-rose-700'"
            >
              {{ data.kpis.scoreDelta >= 0 ? '↑ +' : '↓ ' }}{{ data.kpis.scoreDelta }}%
            </span>
          </div>
          <p class="text-[11px] text-dimmed">
            {{ data?.kpis.pendingMarking ?? 0 }} scripts to mark
          </p>
        </div>
      </UCard>
    </div>

    <!-- Middle 3-Column Grid: My Groups + Today's Classes + Quick Actions -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <!-- My Groups -->
      <UCard :ui="{ body: 'p-5 flex flex-col gap-4 h-full' }">
        <div class="flex items-center justify-between gap-2">
          <h3 class="font-bold text-highlighted text-base">
            My Groups
          </h3>
          <UButton
            label="Create Group"
            icon="i-lucide-plus"
            size="xs"
            @click="creatingGroup = true"
          />
        </div>

        <div
          v-if="data?.groups?.length"
          class="flex flex-col divide-y divide-default/60 flex-1"
        >
          <NuxtLink
            v-for="(g, i) in data.groups.slice(0, 4)"
            :key="g.id"
            :to="`/classes/${g.id}`"
            class="py-3 first:pt-0 last:pb-0 flex items-center gap-3 hover:opacity-90 transition-opacity"
          >
            <div
              class="size-9 rounded-xl grid place-items-center shrink-0"
              :class="GROUP_ICON_STYLES[i % GROUP_ICON_STYLES.length]"
            >
              <UIcon
                name="i-lucide-users"
                class="size-4"
              />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-highlighted truncate">
                {{ g.name }}
              </p>
              <p class="text-xs text-muted">
                {{ g.students }} student{{ g.students === 1 ? '' : 's' }}
              </p>
            </div>
            <UBadge
              v-if="g.level"
              :label="g.level"
              :color="g.level === 'IELTS' ? 'error' : 'primary'"
              variant="subtle"
              size="xs"
            />
            <div class="w-16 shrink-0">
              <p class="text-xs font-semibold text-highlighted text-right tabular-nums">
                {{ g.progress }}%
              </p>
              <div class="h-1.5 rounded-full bg-elevated overflow-hidden mt-1">
                <div
                  class="h-full rounded-full"
                  :class="BAR_BG[i % BAR_BG.length]"
                  :style="{ width: `${g.progress}%` }"
                />
              </div>
            </div>
          </NuxtLink>
        </div>
        <UEmpty
          v-else
          icon="i-lucide-users"
          title="No groups yet"
          description="Create your first group and invite students with a join link."
          variant="naked"
        />

        <div class="pt-2 border-t border-default/60 text-center">
          <UButton
            to="/classes"
            label="View All Groups"
            trailing-icon="i-lucide-arrow-right"
            size="xs"
            color="primary"
            variant="ghost"
          />
        </div>
      </UCard>

      <!-- Today's Classes -->
      <UCard :ui="{ body: 'p-5 flex flex-col gap-4 h-full' }">
        <div class="flex items-center justify-between gap-2">
          <h3 class="font-bold text-highlighted text-base flex items-center gap-2">
            <UIcon
              name="i-lucide-calendar-days"
              class="size-4 text-primary"
            />
            Today's Classes
          </h3>
          <UButton
            to="/teacher/classes"
            label="View Schedule"
            trailing-icon="i-lucide-arrow-right"
            size="xs"
            color="primary"
            variant="ghost"
          />
        </div>

        <div
          v-if="data?.todaysClasses?.length"
          class="flex flex-col gap-2.5 flex-1"
        >
          <div
            v-for="(c, idx) in data.todaysClasses.slice(0, 3)"
            :key="c.id"
            class="flex items-center gap-3 rounded-xl p-3 border transition-colors"
            :class="idx === 0 || c.isLiveNow ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200/70 dark:border-blue-800/50' : 'bg-elevated/40 border-default'"
          >
            <span
              class="size-2.5 rounded-full shrink-0"
              :class="idx === 0 || c.isLiveNow ? 'bg-blue-600 ring-4 ring-blue-500/20' : 'bg-slate-400'"
            />
            <div class="min-w-0 flex-1">
              <p class="text-[11px] font-semibold text-muted tabular-nums">
                {{ fmtTimeRange(c.startsAt, c.endsAt) }}
              </p>
              <p class="text-sm font-semibold text-highlighted truncate">
                {{ c.title }}
              </p>
              <p class="text-xs text-muted truncate">
                {{ c.subtitle }}
              </p>
            </div>
            <UButton
              v-if="c.meetUrl"
              :href="c.meetUrl"
              target="_blank"
              rel="noopener"
              :label="idx === 0 ? 'Start Class' : undefined"
              icon="i-lucide-play"
              size="xs"
              :color="idx === 0 ? 'primary' : 'neutral'"
              :variant="idx === 0 ? 'solid' : 'soft'"
            />
          </div>
        </div>
        <UEmpty
          v-else
          icon="i-lucide-video"
          title="No upcoming classes"
          description="Schedule a Google Meet session inside any group or course lesson."
          variant="naked"
        />
      </UCard>

      <!-- Quick Actions -->
      <UCard :ui="{ body: 'p-5 flex flex-col gap-4 h-full' }">
        <h3 class="font-bold text-highlighted text-base">
          Quick Actions
        </h3>
        <div class="grid grid-cols-2 gap-3 flex-1">
          <button
            type="button"
            class="rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2.5 bg-indigo-50/90 dark:bg-indigo-950/30 hover:bg-indigo-100/80 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer"
            @click="creatingGroup = true"
          >
            <UIcon
              name="i-lucide-users"
              class="size-6 text-indigo-600 dark:text-indigo-400"
            />
            <span class="text-xs sm:text-sm font-semibold text-highlighted">Create Group</span>
          </button>

          <NuxtLink
            to="/teacher/classes"
            class="rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2.5 bg-blue-50/90 dark:bg-blue-950/30 hover:bg-blue-100/80 dark:hover:bg-blue-950/50 transition-colors"
          >
            <UIcon
              name="i-lucide-calendar-plus"
              class="size-6 text-blue-600 dark:text-blue-400"
            />
            <span class="text-xs sm:text-sm font-semibold text-highlighted">Schedule Class</span>
          </NuxtLink>

          <NuxtLink
            to="/teacher/courses"
            class="rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2.5 bg-rose-50/90 dark:bg-rose-950/30 hover:bg-rose-100/80 dark:hover:bg-rose-950/50 transition-colors"
          >
            <UIcon
              name="i-lucide-book-open-check"
              class="size-6 text-rose-600 dark:text-rose-400"
            />
            <span class="text-xs sm:text-sm font-semibold text-highlighted">Course Studio</span>
          </NuxtLink>

          <NuxtLink
            to="/teacher/results"
            class="rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2.5 bg-emerald-50/90 dark:bg-emerald-950/30 hover:bg-emerald-100/80 dark:hover:bg-emerald-950/50 transition-colors"
          >
            <UIcon
              name="i-lucide-bar-chart-3"
              class="size-6 text-emerald-600 dark:text-emerald-400"
            />
            <span class="text-xs sm:text-sm font-semibold text-highlighted">View Results</span>
          </NuxtLink>
        </div>
      </UCard>
    </div>

    <!-- Bottom 2-Column Grid: Recent Test Results + Group Performance Chart -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <!-- Recent Test Results -->
      <UCard :ui="{ body: 'p-5 flex flex-col gap-4' }">
        <div class="flex items-center justify-between gap-2">
          <h3 class="font-bold text-highlighted text-base">
            Recent Test Results
          </h3>
          <UButton
            to="/teacher/results"
            label="View All Results"
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
                  Student
                </th>
                <th class="py-2.5 pe-3">
                  Test / Exercise
                </th>
                <th class="py-2.5 pe-3">
                  Score
                </th>
                <th class="py-2.5">
                  CEFR / IELTS
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default/60">
              <tr
                v-for="r in data?.recentResults ?? []"
                :key="r.id"
                class="hover:bg-elevated/40 transition-colors"
              >
                <td class="py-2.5 pe-3">
                  <div class="flex items-center gap-2.5">
                    <UAvatar
                      :src="r.avatarUrl ?? undefined"
                      :text="r.studentInitials"
                      size="xs"
                    />
                    <span class="font-medium text-highlighted truncate max-w-36">{{ r.studentName }}</span>
                  </div>
                </td>
                <td class="py-2.5 pe-3">
                  <NuxtLink
                    :to="r.to"
                    class="text-toned hover:text-primary truncate block max-w-44"
                  >
                    {{ r.title }}
                  </NuxtLink>
                </td>
                <td class="py-2.5 pe-3">
                  <UBadge
                    :label="r.scoreDisplay"
                    color="success"
                    variant="subtle"
                    size="sm"
                  />
                </td>
                <td class="py-2.5">
                  <UBadge
                    :label="r.badge"
                    :color="r.badge === 'IELTS' ? 'error' : r.badge === 'Passed' ? 'success' : 'primary'"
                    variant="soft"
                    size="sm"
                  />
                </td>
              </tr>
              <tr v-if="!(data?.recentResults?.length)">
                <td
                  colspan="4"
                  class="py-8 text-center text-sm text-muted"
                >
                  No student submissions yet. Assign a test or LMS exercise to your groups.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <!-- Group Performance (Last 4 Weeks) -->
      <UCard :ui="{ body: 'p-5 flex flex-col gap-4' }">
        <div class="flex items-center justify-between gap-2">
          <h3 class="font-bold text-highlighted text-base">
            Group Performance
          </h3>
          <UBadge
            label="Last 4 Weeks"
            color="neutral"
            variant="outline"
            size="sm"
          />
        </div>

        <div
          v-if="data?.performanceGroups?.length"
          class="flex flex-col sm:flex-row items-stretch gap-4 flex-1"
        >
          <div class="flex-1 h-52 flex items-end gap-2 pt-3">
            <!-- Y axis -->
            <div class="flex flex-col justify-between h-full pb-6 text-[11px] text-dimmed tabular-nums pr-1 shrink-0">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0%</span>
            </div>
            <!-- Week clusters -->
            <div class="flex-1 h-full flex flex-col">
              <div class="flex-1 grid grid-cols-4 gap-3 items-end border-b border-default relative">
                <div class="pointer-events-none absolute inset-0 flex flex-col justify-between">
                  <div
                    v-for="n in 4"
                    :key="n"
                    class="border-t border-dashed border-default/60"
                  />
                  <div />
                </div>

                <div
                  v-for="wk in data.groupPerformance"
                  :key="wk.label"
                  class="h-full flex items-end justify-center gap-1.5 z-10 px-1"
                >
                  <div
                    v-for="(v, gIdx) in wk.values"
                    :key="v.groupId"
                    class="relative flex-1 max-w-5 h-full flex items-end"
                    @mouseenter="hoveredCell = `${wk.label}-${v.groupId}`"
                    @mouseleave="hoveredCell = null"
                  >
                    <div
                      v-if="hoveredCell === `${wk.label}-${v.groupId}`"
                      class="absolute -top-2 -translate-y-full left-1/2 -translate-x-1/2 z-20 whitespace-nowrap rounded-lg bg-[#151a34] text-white text-[11px] px-2 py-1 shadow-lg pointer-events-none"
                    >
                      {{ v.groupName }}: {{ v.value }}%
                    </div>
                    <div
                      class="w-full rounded-t transition-all"
                      :style="{ height: `${Math.max(v.value > 0 ? 6 : 2, v.value)}%`, backgroundColor: GROUP_BAR_COLORS[gIdx % GROUP_BAR_COLORS.length] }"
                    />
                  </div>
                </div>
              </div>
              <div class="grid grid-cols-4 gap-3 pt-2 text-[11px] text-dimmed text-center">
                <span
                  v-for="wk in data.groupPerformance"
                  :key="wk.label"
                >{{ wk.label }}</span>
              </div>
            </div>
          </div>

          <!-- Legend -->
          <ul class="sm:w-36 shrink-0 flex flex-row sm:flex-col flex-wrap justify-center gap-2 text-xs">
            <li
              v-for="(g, i) in data.performanceGroups"
              :key="g.id"
              class="flex items-center gap-2"
            >
              <span
                class="size-2.5 rounded-sm shrink-0"
                :style="{ backgroundColor: GROUP_BAR_COLORS[i % GROUP_BAR_COLORS.length] }"
              />
              <span class="truncate text-toned">{{ g.name }}</span>
            </li>
          </ul>
        </div>
        <UEmpty
          v-else
          icon="i-lucide-bar-chart-3"
          title="No performance data yet"
          description="Weekly group averages will appear as students complete tests."
          variant="naked"
        />
      </UCard>
    </div>

    <!-- Quick Create Group Modal -->
    <UModal
      v-model:open="creatingGroup"
      title="Create Student Group"
    >
      <template #body>
        <form
          class="grid gap-4"
          @submit.prevent="createGroup"
        >
          <UFormField label="Group name">
            <UInput
              v-model="groupForm.name"
              placeholder="e.g. B2 Morning IELTS Prep"
              class="w-full"
              autofocus
            />
          </UFormField>
          <UFormField label="Level / Track">
            <USelect
              v-model="groupForm.level"
              :items="levelOptions"
              class="w-full"
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="ghost"
              @click="creatingGroup = false"
            />
            <UButton
              type="submit"
              label="Create Group"
              :loading="savingGroup"
              :disabled="!groupForm.name.trim()"
            />
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
