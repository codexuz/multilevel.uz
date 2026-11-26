<script setup lang="ts">
import type { LiveLesson } from '~/components/online/Row.vue'

/**
 * One of my groups: the work its teacher set (to do first, with due dates), my results in it, its
 * online classes, its vocabulary decks, and classmates by this week's XP. Leaving is in the menu.
 */
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { confirm } = useDialogs()
const { refresh: refreshMe } = useMe()
const id = computed(() => String(route.params.id))

interface Work { id: string, skill: string, partNumber: number | null, note: string | null, dueAt: string | null, createdAt: string, test: { slug: string, title: string } | null, to: string | null, exam: string, mine: { attemptId: string, score: number | null, band: number | null, status: string, at: string } | null }
interface Deck { id: string, title: string, topic: string | null, level: string | null, cards: number, known: number, toPlay: number }
interface Mate { id: string, name: string, avatarUrl: string | null, weekXp: number, me: boolean }
interface GroupPage {
  group: { id: string, name: string, exam: string, level: string | null, description: string | null, joinedAt: string, teacher: { name: string, avatarUrl: string | null } }
  work: Work[]
  online: LiveLesson[]
  decks: Deck[]
  classmates: Mate[]
}
const { data, error } = await useFetch<GroupPage>(() => `/api/me/groups/${id.value}`)
if (error.value) throw createError({ statusCode: 404, message: t('groups.notFound'), fatal: true })
useSeoMeta({ title: () => data.value?.group.name ?? t('groups.title'), robots: 'noindex' })

const todo = computed(() => (data.value?.work ?? []).filter(w => !w.mine).sort((a, b) => (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9')))
const done = computed(() => (data.value?.work ?? []).filter(w => w.mine).sort((a, b) => b.mine!.at.localeCompare(a.mine!.at)))
const online = computed(() => (data.value?.online ?? []).filter(l => l.state === 'UPCOMING' || l.state === 'LIVE'))

const TABS = ['work', 'results', 'online', 'vocabulary', 'classmates'] as const
type Tab = typeof TABS[number]
const tab = computed<Tab>({
  get: () => TABS.find(x => x === route.query.tab) ?? 'work',
  set: v => router.replace({ query: { ...route.query, tab: v === 'work' ? undefined : v } })
})
const tabs = computed(() => [
  { label: t('groups.tabWork'), value: 'work', icon: 'i-lucide-list-todo', badge: todo.value.length || undefined },
  { label: t('groups.tabResults'), value: 'results', icon: 'i-lucide-chart-column' },
  { label: t('nav.online'), value: 'online', icon: 'i-lucide-video', badge: online.value.length || undefined },
  { label: t('groups.tabVocabulary'), value: 'vocabulary', icon: 'i-lucide-layers' },
  { label: t('groups.tabClassmates'), value: 'classmates', icon: 'i-lucide-trophy' }
])

const isIelts = (w: Work) => w.exam === 'IELTS'
const scoreOf = (w: Work) => (w.mine ? (isIelts(w) && w.mine.band != null ? t('tp.band', { band: fmtBand(w.mine.band) }) : w.mine.score != null ? `${w.mine.score}/75` : t('groups.waitingMark')) : '')
const day = (d: string) => localeDate(d, intlLocale(), { day: 'numeric', month: 'short' })
const overdue = (w: Work) => !w.mine && !!w.dueAt && new Date(w.dueAt).getTime() < Date.now()
const workTitle = (w: Work) => `${skillLabel(w.skill)}${w.partNumber ? ` · ${partName(w.skill, w.partNumber, w.exam)}` : ''}`

/** My average per skill over this group's work I handed in (band for IELTS, score of 75 otherwise). */
const averages = computed(() => ['LISTENING', 'READING', 'WRITING', 'SPEAKING'].map((s) => {
  const list = done.value.filter(w => w.skill === s)
  const ielts = list.some(isIelts)
  const vals = list.map(w => (ielts ? w.mine!.band : w.mine!.score)).filter((v): v is number => v != null)
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  return { skill: s, n: list.length, value: avg == null ? '—' : ielts ? fmtBand(Math.round(avg * 2) / 2) : `${Math.round(avg)}/75`, pct: avg == null ? 0 : ielts ? avg / 9 * 100 : avg / 75 * 100 }
}))
const handedIn = computed(() => (data.value?.work.length ? Math.round(done.value.length / data.value.work.length * 100) : 0))

async function leave() {
  if (!data.value) return
  const ok = await confirm({ title: t('groups.leaveTitle', { name: data.value.group.name }), description: t('groups.leaveText'), confirmLabel: t('groups.leave'), color: 'error' })
  if (!ok) return
  try {
    await $fetch(`/api/me/groups/${id.value}/leave`, { method: 'POST' })
    await Promise.all([refreshMe(), refreshNuxtData('my-groups')])
    toast.add({ title: t('groups.left', { name: data.value.group.name }), color: 'success' })
    await navigateTo('/groups')
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  }
}
const menu = computed(() => [[{ label: t('groups.leave'), icon: 'i-lucide-log-out', color: 'error' as const, onSelect: leave }]])
</script>

<template>
  <AppPage
    v-if="data"
    :title="data.group.name"
    icon="i-lucide-users"
    back="/groups"
  >
    <div class="flex flex-col gap-5 max-w-4xl w-full">
      <!-- The group -->
      <div class="flex flex-wrap items-center gap-3">
        <UAvatar
          :src="data.group.teacher.avatarUrl ?? undefined"
          :alt="data.group.teacher.name"
          size="lg"
        />
        <div class="min-w-0 flex-1">
          <h1 class="text-2xl font-extrabold text-highlighted flex flex-wrap items-center gap-2">
            {{ data.group.name }}
            <UBadge
              :label="data.group.exam === 'IELTS' ? 'IELTS' : (data.group.level || 'CEFR')"
              color="neutral"
              variant="subtle"
            />
          </h1>
          <p class="text-sm text-muted">
            {{ t('groups.teacher', { name: data.group.teacher.name }) }} · {{ t('groups.members', { n: data.classmates.length }, data.classmates.length) }}
          </p>
          <p
            v-if="data.group.description"
            class="text-sm text-toned mt-1"
          >
            {{ data.group.description }}
          </p>
        </div>
        <UDropdownMenu :items="menu">
          <UButton
            icon="i-lucide-ellipsis"
            color="neutral"
            variant="outline"
            :aria-label="t('groups.more')"
            data-testid="group-menu"
          />
        </UDropdownMenu>
      </div>

      <UTabs
        v-model="tab"
        :items="tabs"
        :content="false"
        class="w-full overflow-x-auto"
        data-testid="group-tabs"
      />

      <!-- Work: to do first (earliest due), then what I handed in -->
      <template v-if="tab === 'work'">
        <section class="flex flex-col gap-2">
          <h2 class="text-sm font-extrabold uppercase tracking-wide text-muted">
            {{ t('groups.toDo') }}
          </h2>
          <div
            v-if="todo.length"
            class="rounded-[var(--card-radius)] ring-2 ring-default divide-y divide-default overflow-hidden bg-default"
            data-testid="group-todo"
          >
            <div
              v-for="w in todo"
              :key="w.id"
              class="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <UIcon
                name="i-lucide-circle-dot"
                class="size-5 shrink-0"
                :class="overdue(w) ? 'text-error' : 'text-primary'"
              />
              <div class="min-w-0 flex-1">
                <p class="font-bold text-highlighted truncate">
                  {{ w.test?.title || t('sdash.test') }}
                </p>
                <p class="text-xs text-muted">
                  {{ workTitle(w) }}<span
                    v-if="w.dueAt"
                    :class="overdue(w) ? 'text-error font-bold' : ''"
                  > · {{ overdue(w) ? t('groups.overdue', { date: day(w.dueAt) }) : t('sdash.due', { date: day(w.dueAt) }) }}</span>
                </p>
                <p
                  v-if="w.note"
                  class="text-xs text-toned mt-0.5"
                >
                  {{ w.note }}
                </p>
              </div>
              <UButton
                v-if="w.to"
                :to="w.to"
                :label="t('courses.taskStart')"
                trailing-icon="i-lucide-arrow-right"
                size="sm"
              />
            </div>
          </div>
          <div
            v-else
            class="rounded-[var(--card-radius)] bg-success/10 text-success p-4 flex items-center gap-3 font-bold"
          >
            <UIcon
              name="i-lucide-party-popper"
              class="size-6"
            />
            {{ data.work.length ? t('groups.allDoneText') : t('work.none') }}
          </div>
        </section>

        <section
          v-if="done.length"
          class="flex flex-col gap-2"
        >
          <h2 class="text-sm font-extrabold uppercase tracking-wide text-muted">
            {{ t('groups.handedIn') }}
          </h2>
          <div class="rounded-[var(--card-radius)] ring-2 ring-default divide-y divide-default overflow-hidden bg-default">
            <NuxtLink
              v-for="w in done"
              :key="w.id"
              :to="`/results/${w.mine!.attemptId}`"
              class="flex items-center gap-3 px-4 py-3 hover:bg-elevated/40"
            >
              <UIcon
                name="i-lucide-circle-check"
                class="size-5 shrink-0 text-success"
              />
              <div class="min-w-0 flex-1">
                <p class="font-bold text-highlighted truncate">
                  {{ w.test?.title || t('sdash.test') }}
                </p>
                <p class="text-xs text-muted">
                  {{ workTitle(w) }} · {{ day(w.mine!.at) }}
                </p>
              </div>
              <span class="font-extrabold tabular-nums text-highlighted">{{ scoreOf(w) }}</span>
              <UIcon
                name="i-lucide-chevron-right"
                class="size-4 text-dimmed"
              />
            </NuxtLink>
          </div>
        </section>
      </template>

      <!-- My results in this group -->
      <template v-else-if="tab === 'results'">
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div
            v-for="a in averages"
            :key="a.skill"
            class="rounded-[var(--card-radius)] ring-2 ring-default bg-default p-4"
          >
            <p class="text-xs font-extrabold uppercase tracking-wide text-muted">
              {{ skillLabel(a.skill) }}
            </p>
            <p class="text-2xl font-extrabold text-highlighted tabular-nums mt-1">
              {{ a.value }}
            </p>
            <div class="h-2 rounded-full bg-accented/70 overflow-hidden mt-2">
              <div
                class="h-full rounded-full bg-primary"
                :style="{ width: `${Math.round(a.pct)}%` }"
              />
            </div>
            <p class="text-xs text-muted mt-1.5">
              {{ t('res.attempts', { n: a.n }, a.n) }}
            </p>
          </div>
        </div>
        <div class="rounded-[var(--card-radius)] ring-2 ring-default bg-default p-4 flex items-center gap-4">
          <div class="flex-1">
            <p class="font-extrabold text-highlighted">
              {{ t('groups.handedInOf', { n: done.length, total: data.work.length }) }}
            </p>
            <div class="h-3 rounded-full bg-accented/70 overflow-hidden mt-2">
              <div
                class="h-full rounded-full bg-correct"
                :style="{ width: `${handedIn}%` }"
              />
            </div>
          </div>
          <span class="text-2xl font-extrabold tabular-nums text-highlighted">{{ handedIn }}%</span>
        </div>
        <div
          v-if="done.length"
          class="rounded-[var(--card-radius)] ring-2 ring-default bg-default overflow-x-auto"
          data-testid="group-results"
        >
          <table class="w-full text-sm min-w-[32rem]">
            <thead>
              <tr class="border-b-2 border-default text-left text-xs font-extrabold uppercase tracking-wide text-muted">
                <th class="px-4 py-3">
                  {{ t('tp.testSkill') }}
                </th>
                <th class="px-4 py-3">
                  {{ t('tp.score') }}
                </th>
                <th class="px-4 py-3">
                  {{ t('tp.date') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="w in done"
                :key="w.id"
                class="hover:bg-elevated/40"
              >
                <td class="px-4 py-3">
                  <NuxtLink
                    :to="`/results/${w.mine!.attemptId}`"
                    class="font-semibold text-highlighted hover:text-primary"
                  >
                    {{ w.test?.title || t('sdash.test') }}
                  </NuxtLink>
                  <p class="text-xs text-muted">
                    {{ workTitle(w) }}
                  </p>
                </td>
                <td class="px-4 py-3 font-extrabold tabular-nums">
                  {{ scoreOf(w) }}
                </td>
                <td class="px-4 py-3 text-xs text-muted whitespace-nowrap">
                  {{ day(w.mine!.at) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <UEmpty
          v-else
          icon="i-lucide-chart-column"
          :title="t('groups.noResults')"
          variant="naked"
        />
      </template>

      <!-- Online classes -->
      <template v-else-if="tab === 'online'">
        <div
          v-if="online.length"
          class="rounded-[var(--card-radius)] ring-2 ring-default divide-y divide-default overflow-hidden bg-default"
        >
          <OnlineRow
            v-for="l in online"
            :key="l.id"
            :lesson="l"
          />
        </div>
        <UEmpty
          v-else
          icon="i-lucide-video-off"
          :title="t('online.noneComing')"
          :description="t('groups.noOnlineText')"
          variant="naked"
        />
      </template>

      <!-- Vocabulary decks set to this group -->
      <template v-else-if="tab === 'vocabulary'">
        <div
          v-if="data.decks.length"
          class="grid sm:grid-cols-2 gap-3"
        >
          <div
            v-for="d in data.decks"
            :key="d.id"
            class="tile p-4 flex flex-col gap-3"
          >
            <div class="flex items-start gap-3">
              <span class="grid place-items-center size-11 rounded-lg bg-primary/10 text-primary shrink-0">
                <UIcon
                  name="i-lucide-layers"
                  class="size-6"
                />
              </span>
              <div class="min-w-0 flex-1">
                <p class="font-extrabold text-highlighted truncate">
                  {{ d.title }}
                </p>
                <p class="text-xs text-muted">
                  {{ t('words.deckKnown', { n: d.known, total: d.cards }) }}
                </p>
              </div>
              <UBadge
                v-if="d.level"
                :label="d.level"
                color="neutral"
                variant="subtle"
                size="sm"
              />
            </div>
            <div class="h-3 rounded-full bg-accented/70 overflow-hidden">
              <div
                class="h-full rounded-full bg-correct"
                :style="{ width: `${d.cards ? Math.round(d.known / d.cards * 100) : 0}%` }"
              />
            </div>
            <UPageList class="flex-row items-center gap-2">
              <UButton
                :to="`/words/decks/${d.id}`"
                :label="t('deckStudy.studyWords')"
                icon="i-lucide-book-open"
                :color="d.toPlay ? 'primary' : 'neutral'"
                :variant="d.toPlay ? 'solid' : 'outline'"
                :disabled="!d.cards"
                class="flex-1 justify-center"
              />
              <UButton
                :to="`/words/play?deck=${d.id}`"
                :label="d.toPlay ? t('words.play') : t('words.playAgain')"
                :icon="d.toPlay ? 'i-lucide-play' : 'i-lucide-rotate-ccw'"
                color="neutral"
                variant="outline"
                :disabled="!d.cards"
              />
            </UPageList>
          </div>
        </div>
        <UEmpty
          v-else
          icon="i-lucide-layers"
          :title="t('words.decksEmpty')"
          :description="t('words.decksEmptyText')"
          variant="naked"
        />
      </template>

      <!-- Classmates by this week's XP -->
      <template v-else>
        <p class="text-sm text-muted">
          {{ t('groups.leagueText') }}
        </p>
        <ol
          class="rounded-[var(--card-radius)] ring-2 ring-default divide-y divide-default overflow-hidden bg-default"
          data-testid="group-league"
        >
          <li
            v-for="(m, i) in data.classmates"
            :key="m.id"
            class="flex items-center gap-3 px-4 py-2.5"
            :class="m.me ? 'bg-primary/10' : ''"
          >
            <span
              class="grid place-items-center size-7 rounded-full text-xs font-extrabold tabular-nums shrink-0"
              :class="m.weekXp > 0 && i < 3 ? ['bg-xp text-white', 'bg-accented text-highlighted', 'bg-flame/70 text-white'][i] : 'text-muted'"
            >{{ i + 1 }}</span>
            <UAvatar
              :src="m.avatarUrl ?? undefined"
              :alt="m.name"
              size="sm"
            />
            <span class="font-bold text-highlighted truncate flex-1">{{ m.name }}<span
              v-if="m.me"
              class="text-primary"
            > · {{ t('groups.you') }}</span></span>
            <span
              class="inline-flex items-center gap-0.5 font-extrabold tabular-nums"
              :class="m.weekXp ? 'text-xp' : 'text-dimmed'"
            >
              <UIcon
                name="i-lucide-zap"
                class="size-4"
              />{{ m.weekXp }}
            </span>
          </li>
        </ol>
      </template>
    </div>
  </AppPage>
</template>
