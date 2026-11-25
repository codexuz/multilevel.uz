<script setup lang="ts">
import type { LiveLesson } from '~/components/online/Row.vue'

interface RecentTest {
  id: string
  skill: string
  exam?: string
  partNumber: number | null
  status: string
  test: { slug: string, title: string } | null
  submittedAt: string
  correct: number | null
  total: number | null
  score: number | null
  band?: number | null
  cefrLevel: string | null
  held?: boolean
}

interface DashboardPayload {
  summary: {
    testsDone: number
    coursesCount: number
    lessonsCompleted: number
    totalCourseLessons: number
    exercisesPassed: number
    avgExerciseScore: number | null
    wordsDue: number
    pendingAssignments: number
  }
  skills: Array<{ skill: string, exam: string, value: number | null, pct: number, attempts: number }>
  recentTests: RecentTest[]
  groups: Array<{ id: string, name: string, exam: string, level: string | null }>
  assignments: Array<{
    id: string
    group: string
    exam: string
    skill: string
    partNumber: number | null
    note: string | null
    dueAt: string | null
    test: { slug: string, title: string } | null
    to: string | null
    mine: { attemptId: string, score: number | null, band: number | null, status: string, at: string } | null
  }>
  upcomingClasses: LiveLesson[]
  courses: Array<{
    id: string
    slug: string
    title: string
    exam: string | null
    level: string | null
    dripMode: DripMode
    modules: number
    lessons: number
    done: number
    progressPct: number
    exercisesTotal: number
    exercisesPassed: number
    nextLessonId: string | null
  }>
}

const { me } = useMe()
const { t } = useI18n()
useSeoMeta({ title: () => t('nav.dashboard'), robots: 'noindex' })
const { data, status } = await useFetch<DashboardPayload>('/api/me/dashboard')
const { xp } = useXp()

const firstName = computed(() => me.value?.name?.split(' ')[0] || '')
const courseOverallPct = computed(() => {
  const tot = data.value?.summary.totalCourseLessons ?? 0
  const done = data.value?.summary.lessonsCompleted ?? 0
  return tot > 0 ? Math.round((done / tot) * 100) : 0
})
const hasGroups = computed(() => (data.value?.groups?.length ?? 0) > 0)
const isOverdue = (dueAt: string | null, done: boolean) => !!dueAt && !done && new Date(dueAt) < new Date()
</script>

<template>
  <AppPage
    :title="t('nav.dashboard')"
    icon="i-lucide-layout-dashboard"
  >
    <template #actions>
      <UButton
        to="/tests"
        :label="t('sdash.takeTest')"
        icon="i-lucide-clipboard-list"
        size="sm"
      />
      <UButton
        to="/courses"
        :label="t('nav.courses')"
        icon="i-lucide-graduation-cap"
        size="sm"
        color="neutral"
        variant="outline"
      />
    </template>

    <div class="flex flex-col gap-5 w-full">
      <!-- Greeting Header -->
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold text-highlighted">
            {{ firstName ? t('sdash.welcome', { name: firstName }) : t('nav.dashboard') }}
          </h1>
          <p class="text-sm text-muted mt-0.5">
            {{ t('sdash.lead') }}
          </p>
        </div>
        <div
          v-if="hasGroups"
          class="flex flex-wrap items-center gap-1.5"
        >
          <UBadge
            v-for="g in data!.groups"
            :key="g.id"
            :label="`${g.name} · ${g.exam === 'IELTS' ? 'IELTS' : 'Multilevel'}`"
            icon="i-lucide-users"
            color="primary"
            variant="subtle"
            size="sm"
          />
        </div>
      </div>

      <!-- Loading Skeleton -->
      <div
        v-if="status === 'pending' && !data"
        class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <USkeleton
          v-for="i in 4"
          :key="i"
          class="h-24 rounded-xl"
        />
      </div>

      <template v-else-if="data">
        <UCard
          v-if="xp"
          :ui="{ body: 'p-4 sm:p-5' }"
        >
          <XpGoalCard :xp="xp" />
        </UCard>

        <!-- 4 Summary Progress Tiles -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile
            :label="t('sdash.testsDone')"
            :value="data.summary.testsDone"
            icon="i-lucide-clipboard-check"
            color="neutral"
          />
          <StatTile
            :label="t('sdash.courseProgress')"
            :value="`${courseOverallPct}%`"
            icon="i-lucide-graduation-cap"
            color="neutral"
          />
          <StatTile
            :label="t('builder.quizzesPassed')"
            :value="data.summary.exercisesPassed"
            icon="i-lucide-list-checks"
            color="neutral"
          />
          <StatTile
            :label="hasGroups ? t('sdash.pending') : t('sdash.wordsDue')"
            :value="hasGroups ? data.summary.pendingAssignments : data.summary.wordsDue"
            :icon="hasGroups ? 'i-lucide-calendar-check' : 'i-lucide-book-open-text'"
            :color="(hasGroups ? data.summary.pendingAssignments : data.summary.wordsDue) > 0 ? 'warning' : 'neutral'"
          />
        </div>

        <!-- Skill Progress Breakdown -->
        <UCard :ui="{ body: 'p-4 sm:p-5 flex flex-col gap-4' }">
          <div class="flex items-center justify-between gap-2">
            <h2 class="font-semibold text-highlighted flex items-center gap-2">
              <UIcon
                name="i-lucide-trending-up"
                class="size-4 text-primary"
              />
              {{ t('sdash.skills') }}
            </h2>
            <UButton
              to="/results"
              :label="t('sdash.allResults')"
              trailing-icon="i-lucide-arrow-right"
              size="xs"
              color="neutral"
              variant="ghost"
            />
          </div>
          <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div
              v-for="s in data.skills"
              :key="s.skill"
              class="rounded-xl bg-elevated/60 ring ring-default p-3.5 flex flex-col gap-2"
            >
              <div class="flex items-center gap-2.5">
                <img
                  :src="SKILL_ART[s.skill]"
                  alt=""
                  class="size-7 shrink-0"
                >
                <div class="min-w-0 flex-1">
                  <p class="text-xs text-muted">
                    {{ skillLabel(s.skill) }}
                  </p>
                  <p class="text-base font-bold text-highlighted tabular-nums leading-tight">
                    <template v-if="s.value != null">
                      {{ s.exam === 'IELTS' ? t('tp.band', { band: fmtBand(s.value) }) : `${s.value} / 75` }}
                    </template>
                    <template v-else>
                      {{ t('sdash.notYet') }}
                    </template>
                  </p>
                </div>
                <span class="text-[11px] text-dimmed">{{ s.attempts }}×</span>
              </div>
              <UProgress
                :model-value="s.pct"
                size="xs"
              />
            </div>
          </div>
        </UCard>

        <!-- Group Assignments & Online Classes (ONLY shown if student joined a group) -->
        <div
          v-if="hasGroups"
          class="grid lg:grid-cols-3 gap-5"
        >
          <UCard
            :class="data.upcomingClasses.length ? 'lg:col-span-2' : 'lg:col-span-3'"
            :ui="{ body: 'p-4 sm:p-5 flex flex-col gap-3' }"
          >
            <div class="flex items-center justify-between gap-2">
              <h2 class="font-semibold text-highlighted flex items-center gap-2">
                <UIcon
                  name="i-lucide-list-todo"
                  class="size-4 text-primary"
                />
                {{ t('sdash.assignments') }}
              </h2>
              <UBadge
                :label="t('sdash.pendingN', { n: data.summary.pendingAssignments })"
                :color="data.summary.pendingAssignments ? 'warning' : 'success'"
                variant="subtle"
                size="xs"
              />
            </div>

            <div
              v-if="data.assignments.length"
              class="rounded-xl ring ring-default divide-y divide-default overflow-hidden"
            >
              <div
                v-for="a in data.assignments.slice(0, 6)"
                :key="a.id"
                class="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <UIcon
                  :name="a.mine ? 'i-lucide-circle-check' : 'i-lucide-circle-dot'"
                  class="size-5 shrink-0"
                  :class="a.mine ? 'text-success' : isOverdue(a.dueAt, !!a.mine) ? 'text-error' : 'text-primary'"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-highlighted truncate">
                    {{ a.test?.title || t('sdash.test') }} · {{ skillLabel(a.skill) }}{{ a.partNumber ? ` (${partName(a.skill, a.partNumber, a.exam)})` : '' }}
                  </p>
                  <p class="text-xs text-muted truncate">
                    {{ a.group }}
                    <span v-if="a.dueAt"> · {{ t('sdash.due', { date: localeDate(a.dueAt, intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) }) }}</span>
                    <span v-if="a.note"> · {{ a.note }}</span>
                  </p>
                </div>
                <UButton
                  v-if="a.mine"
                  :to="`/results/${a.mine.attemptId}`"
                  :label="a.mine.band != null ? t('tp.band', { band: fmtBand(a.mine.band) }) : a.mine.score != null ? `${a.mine.score}/75` : t('tp.submitted')"
                  size="xs"
                  color="success"
                  variant="soft"
                />
                <UButton
                  v-else-if="a.to"
                  :to="a.to"
                  :label="t('courses.taskStart')"
                  trailing-icon="i-lucide-arrow-right"
                  size="xs"
                />
              </div>
            </div>
            <p
              v-else
              class="text-sm text-muted"
            >
              {{ t('sdash.noAssignments') }}
            </p>
          </UCard>

          <UCard
            v-if="data.upcomingClasses.length"
            :ui="{ body: 'p-4 sm:p-5 flex flex-col gap-3' }"
          >
            <div class="flex items-center justify-between gap-2">
              <h2 class="font-semibold text-highlighted flex items-center gap-2">
                <UIcon
                  name="i-lucide-video"
                  class="size-4 text-primary"
                />
                {{ t('nav.online') }}
              </h2>
              <UButton
                to="/online"
                :label="t('tdash.all')"
                size="xs"
                color="neutral"
                variant="ghost"
              />
            </div>
            <div class="divide-y divide-default rounded-xl ring ring-default overflow-hidden">
              <OnlineRow
                v-for="l in data.upcomingClasses.slice(0, 3)"
                :key="l.id"
                :lesson="l"
              />
            </div>
          </UCard>
        </div>

        <!-- Bottom 2-Column Grid: Course Progress + Tests Last Done -->
        <div class="grid lg:grid-cols-2 gap-5">
          <!-- LMS Course Progress -->
          <UCard :ui="{ body: 'p-4 sm:p-5 flex flex-col gap-4' }">
            <div class="flex items-center justify-between gap-2">
              <h2 class="font-semibold text-highlighted flex items-center gap-2">
                <UIcon
                  name="i-lucide-graduation-cap"
                  class="size-4 text-primary"
                />
                {{ t('sdash.courseProgress') }}
              </h2>
              <UButton
                to="/courses"
                :label="t('courses.browse')"
                trailing-icon="i-lucide-arrow-right"
                size="xs"
                color="neutral"
                variant="ghost"
              />
            </div>

            <div
              v-if="data.courses.length"
              class="flex flex-col gap-3"
            >
              <div
                v-for="c in data.courses"
                :key="c.id"
                class="rounded-xl ring ring-default p-3.5 flex flex-col gap-2.5"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <NuxtLink
                      :to="`/courses/${c.slug}`"
                      class="font-semibold text-sm text-highlighted hover:text-primary line-clamp-1"
                    >
                      {{ c.title }}
                    </NuxtLink>
                    <p class="text-xs text-muted mt-0.5">
                      {{ t('courses.learnerDone', { done: c.done, of: c.lessons }) }}
                      <span v-if="c.exercisesTotal"> · {{ t('sdash.quizzesDone', { done: c.exercisesPassed, of: c.exercisesTotal }) }}</span>
                    </p>
                  </div>
                  <UButton
                    :to="c.nextLessonId ? `/courses/${c.slug}/${c.nextLessonId}` : `/courses/${c.slug}`"
                    :label="c.done > 0 ? t('courses.continue') : t('courses.taskStart')"
                    size="xs"
                    variant="soft"
                    trailing-icon="i-lucide-arrow-right"
                  />
                </div>
                <div class="flex items-center gap-2">
                  <UProgress
                    :model-value="c.progressPct"
                    size="xs"
                    class="flex-1"
                  />
                  <span class="text-xs font-semibold text-highlighted tabular-nums">{{ c.progressPct }}%</span>
                </div>
              </div>
            </div>
            <UEmpty
              v-else
              icon="i-lucide-graduation-cap"
              :title="t('sdash.noCourses')"
              :description="t('sdash.noCoursesText')"
              :actions="[{ label: t('courses.browse'), to: '/courses' }]"
              variant="naked"
            />
          </UCard>

          <!-- Tests Last Done -->
          <UCard :ui="{ body: 'p-4 sm:p-5 flex flex-col gap-4' }">
            <div class="flex items-center justify-between gap-2">
              <h2 class="font-semibold text-highlighted flex items-center gap-2">
                <UIcon
                  name="i-lucide-history"
                  class="size-4 text-primary"
                />
                {{ t('sdash.lastTests') }}
              </h2>
              <UButton
                to="/results"
                :label="t('sdash.allResults')"
                trailing-icon="i-lucide-arrow-right"
                size="xs"
                color="neutral"
                variant="ghost"
              />
            </div>

            <div
              v-if="data.recentTests.length"
              class="rounded-xl ring ring-default divide-y divide-default overflow-hidden"
            >
              <NuxtLink
                v-for="r in data.recentTests"
                :key="r.id"
                :to="`/results/${r.id}`"
                class="flex items-center gap-3 px-3.5 py-2.5 hover:bg-elevated/50 transition-colors"
              >
                <div class="size-9 shrink-0 rounded-lg bg-elevated grid place-items-center">
                  <img
                    :src="SKILL_ART[r.skill]"
                    alt=""
                    class="size-6"
                  >
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-highlighted truncate">
                    {{ r.test?.title || t('sdash.test') }}
                  </p>
                  <p class="text-xs text-muted truncate">
                    {{ r.exam === 'IELTS' ? 'IELTS · ' : '' }}{{ skillLabel(r.skill) }}{{ r.partNumber ? ` ${partName(r.skill, r.partNumber, r.exam)}` : '' }} · {{ relativeTime(r.submittedAt) }}
                  </p>
                </div>
                <div
                  v-if="hasResult(r)"
                  class="text-right shrink-0"
                >
                  <p class="text-sm font-bold text-highlighted tabular-nums leading-none">
                    {{ fmtResult(r) }}<span class="text-[11px] font-normal text-muted">{{ r.band != null ? '' : '/75' }}</span>
                  </p>
                  <UBadge
                    v-if="resultLevel(r)"
                    :label="resultLevel(r) === 'A2' ? t('common.belowB1') : resultLevel(r)!"
                    :color="resultColor(r)"
                    variant="soft"
                    size="xs"
                    class="mt-1"
                  />
                </div>
                <UBadge
                  v-else
                  :label="r.held ? t('sdash.held') : t('sdash.marking')"
                  color="neutral"
                  variant="subtle"
                  size="xs"
                />
              </NuxtLink>
            </div>
            <UEmpty
              v-else
              icon="i-lucide-clipboard-list"
              :title="t('sdash.noTests')"
              :description="t('sdash.noTestsText')"
              :actions="[{ label: t('sdash.takeTest'), to: '/tests' }]"
              variant="naked"
            />
          </UCard>
        </div>
      </template>
    </div>
  </AppPage>
</template>
