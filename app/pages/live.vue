<script setup lang="ts">
import type { LiveMock } from '~/composables/useLiveMock'

/**
 * The live mock: everyone sits the same test in the same window, and Listening and Reading are ranked
 * on one leaderboard as people hand in. Shows the mock open now (or the next one) and a leaderboard,
 * the current one or, with ?mock=ID, an earlier one.
 */
const { t } = useI18n()
useSeoMeta({
  title: () => t('live.seoTitle'),
  description: () => t('live.seoText')
})

interface Row { rank: number, name: string, total: number, scores: Record<string, number>, you: boolean }
interface Board { participants: number, top: Row[], me: Row | null, done: { skill: string, attemptId: string, score: number | null }[] }

const route = useRoute()
const { loggedIn } = useMe()
const { data, refresh } = await useFetch<{ live: LiveMock | null, next: LiveMock | null, shown: LiveMock | null, board: Board | null }>('/api/live', {
  query: computed(() => ({ mock: route.query.mock || undefined }))
})

const RANKED = ['LISTENING', 'READING']
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
let poll: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => (now.value = Date.now()), 1000)
  // The board moves as people hand in.
  poll = setInterval(() => data.value?.live && refresh(), 60_000)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  clearInterval(poll)
})

function countdown(to: string) {
  const s = Math.max(0, Math.floor((new Date(to).getTime() - now.value) / 1000))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return d ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s % 60}s`
}
const when = (d: string) => new Date(d).toLocaleString(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
const doneOf = (skill: string) => data.value?.board?.done.find(d => d.skill === skill)
const showingLive = computed(() => !!data.value?.shown && data.value.shown.id === data.value.live?.id)
const medal = (rank: number) => ({ 1: '🥇', 2: '🥈', 3: '🥉' } as Record<number, string>)[rank] ?? String(rank)
const rankedSkills = computed(() => (data.value?.shown?.skills ?? []).filter(s => RANKED.includes(s)))
</script>

<template>
  <AppPage
    :title="t('nav.live')"
    icon="i-lucide-trophy"
  >
    <div class="flex flex-col gap-5 max-w-3xl w-full">
      <h1 class="text-2xl sm:text-3xl font-bold text-highlighted">
        Live <span class="text-accent">mock</span>
      </h1>

      <!-- Open now -->
      <div
        v-if="data?.live"
        class="rounded-2xl p-5 sm:p-6 text-white bg-gradient-to-br from-primary-500 to-primary-700 flex flex-col gap-4"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <UBadge
              :label="t('live.now')"
              color="error"
              variant="solid"
              size="sm"
              icon="i-lucide-radio"
            />
            <h2 class="text-xl sm:text-2xl font-bold mt-2">
              {{ data.live.title }}
            </h2>
            <p class="text-sm text-white/80">
              {{ data.live.test?.title }} · {{ t('live.ends', { when: when(data.live.endsAt) }) }}
            </p>
          </div>
          <ClientOnly>
            <div class="text-right shrink-0">
              <p class="text-xs text-white/70">
                {{ t('live.endsIn') }}
              </p>
              <p class="text-lg font-bold tabular-nums">
                {{ countdown(data.live.endsAt) }}
              </p>
            </div>
          </ClientOnly>
        </div>
        <div class="grid sm:grid-cols-2 gap-2">
          <div
            v-for="skill in data.live.skills"
            :key="skill"
            class="flex items-center gap-3 rounded-xl bg-white/12 px-3 py-2.5"
          >
            <img
              :src="SKILL_ART[skill]"
              alt=""
              class="size-7 shrink-0"
            >
            <div class="flex-1 min-w-0">
              <p class="font-medium">
                {{ skillLabel(skill) }}
              </p>
              <p class="text-xs text-white/70">
                {{ RANKED.includes(skill) ? t('live.ranked') : t('live.notRanked') }}
              </p>
            </div>
            <UButton
              v-if="doneOf(skill)"
              :to="`/results/${doneOf(skill)!.attemptId}`"
              :label="doneOf(skill)!.score != null ? `${doneOf(skill)!.score}/75` : t('work.handedIn')"
              icon="i-lucide-check"
              size="sm"
              color="neutral"
              variant="solid"
            />
            <UButton
              v-else
              :to="loggedIn ? `/tests/${data.live.test?.slug}/${skill.toLowerCase()}` : `/login?next=${encodeURIComponent('/live')}`"
              :label="loggedIn ? t('common.start') : t('nav.signIn')"
              trailing-icon="i-lucide-arrow-right"
              size="sm"
              color="neutral"
              variant="solid"
            />
          </div>
        </div>
        <p class="text-xs text-white/75">
          {{ t('live.firstTry') }}
        </p>
      </div>

      <!-- Next -->
      <UCard v-if="data?.next">
        <div class="flex flex-col sm:flex-row sm:items-center gap-3">
          <div class="size-11 shrink-0 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <UIcon
              name="i-lucide-calendar-clock"
              class="size-6"
            />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs text-muted">
              {{ data.live ? t('live.afterThis') : t('live.next') }}
            </p>
            <p class="font-semibold text-highlighted">
              {{ data.next.title }}
            </p>
            <p class="text-sm text-muted">
              {{ t('live.bannerNext', { when: when(data.next.startsAt) }) }}<ClientOnly> · {{ t('live.in', { time: countdown(data.next.startsAt) }) }}</ClientOnly>
            </p>
          </div>
          <p class="text-xs text-muted sm:max-w-48">
            {{ t('live.botTells') }}
          </p>
        </div>
      </UCard>

      <div
        v-if="!data?.live && !data?.next && !data?.shown"
        class="flex flex-col items-center text-center gap-3 rounded-xl ring ring-default px-6 py-12"
      >
        <UIcon
          name="i-lucide-trophy"
          class="size-12 text-primary"
        />
        <p class="font-semibold text-highlighted">
          {{ t('live.none') }}
        </p>
        <p class="text-sm text-muted max-w-sm">
          {{ t('live.noneText') }}
        </p>
        <UButton
          to="/tests"
          :label="t('live.meanwhile')"
          class="mt-1"
        />
      </div>

      <!-- Leaderboard -->
      <UCard
        v-if="data?.shown && data.board"
        :ui="{ body: 'p-0 sm:p-0' }"
      >
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <h2 class="font-semibold text-highlighted">
                {{ showingLive ? t('live.leaderboard') : t('live.final') }}
              </h2>
              <p class="text-xs text-muted truncate">
                {{ data.shown.title }} · {{ t('live.people', { n: data.board.participants }, data.board.participants) }}
                · {{ t('live.outOf', { skills: rankedSkills.map(s => skillLabel(s)).join(' + '), max: rankedSkills.length * 75 }) }}
              </p>
            </div>
            <UBadge
              v-if="data.board.me"
              :label="t('live.you', { rank: data.board.me.rank })"
              color="primary"
              variant="soft"
            />
          </div>
        </template>
        <p
          v-if="!data.board.top.length"
          class="text-sm text-muted text-center px-6 py-10"
        >
          {{ t('live.nobody') }}
        </p>
        <ol
          v-else
          class="divide-y divide-default"
        >
          <li
            v-for="r in [...data.board.top, ...(data.board.me && !data.board.top.some(t => t.you) ? [data.board.me] : [])]"
            :key="`${r.rank}-${r.name}`"
            class="flex items-center gap-3 px-4 sm:px-6 py-2.5"
            :class="r.you ? 'bg-primary/8' : ''"
          >
            <span
              class="w-8 text-center tabular-nums shrink-0"
              :class="r.rank <= 3 ? 'text-lg' : 'text-sm text-muted'"
            >{{ medal(r.rank) }}</span>
            <span
              class="flex-1 min-w-0 truncate"
              :class="r.you ? 'font-semibold text-highlighted' : 'text-default'"
            >{{ r.name }}{{ r.you ? ` (${t('live.youWord')})` : '' }}</span>
            <span
              v-for="s in rankedSkills"
              :key="s"
              class="hidden sm:inline w-16 text-right text-xs text-muted tabular-nums"
            >{{ skillLabel(s).slice(0, 1) }} {{ r.scores[s] ?? '—' }}</span>
            <span class="w-12 text-right font-semibold text-highlighted tabular-nums">{{ r.total }}</span>
          </li>
        </ol>
      </UCard>
    </div>
  </AppPage>
</template>
