<script setup lang="ts">
import type { LiveLesson } from '~/components/online/Row.vue'

/**
 * My online classes on Google Meet: only those still to come or on now (a cancelled or finished one
 * is not shown). The next one stands out with a countdown, and Join opens a quarter of an hour before
 * it starts; the others follow by day.
 */
const { t } = useI18n()
useSeoMeta({ title: () => t('online.title'), robots: 'noindex' })
const { data, status, refresh } = await useFetch<{ learning: LiveLesson[] }>('/api/me/live-lessons', { default: () => ({ learning: [] }) })
// Every half minute: the countdown moves, and once a minute the list is fetched again so Join opens on time.
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
let ticks = 0
onMounted(() => (timer = setInterval(() => {
  now.value = Date.now()
  if (++ticks % 2 === 0) refresh()
}, 30_000)))
onBeforeUnmount(() => clearInterval(timer))

const lessons = computed(() => data.value.learning.filter(l => l.state === 'UPCOMING' || l.state === 'LIVE').sort((a, b) => a.startsAt.localeCompare(b.startsAt)))
const next = computed(() => lessons.value[0] ?? null)
const later = computed(() => {
  const today = siteDay(now.value)
  const tomorrow = siteDay(now.value + 864e5)
  const out: { label: string, lessons: LiveLesson[] }[] = []
  for (const l of lessons.value.slice(1)) {
    const d = siteDay(l.startsAt)
    const label = d <= today ? t('online.today') : d === tomorrow ? t('online.tomorrow') : localeDate(l.startsAt, intlLocale(), { weekday: 'long', day: 'numeric', month: 'long' })
    const g = out.at(-1)
    if (g?.label === label) g.lessons.push(l)
    else out.push({ label, lessons: [l] })
  }
  return out
})

/** "in 2 h 15 min", "in 3 days" or "On now". */
const countdown = computed(() => {
  const l = next.value
  if (!l) return ''
  if (l.state === 'LIVE') return t('online.live')
  const mins = Math.max(1, Math.round((new Date(l.startsAt).getTime() - now.value) / 60_000))
  if (mins < 60) return t('online.inMinutes', { n: mins })
  if (mins < 24 * 60) return t('online.inHours', { h: Math.floor(mins / 60), m: mins % 60 })
  const days = Math.round(mins / 1440)
  return t('online.inDays', { n: days }, days)
})
const time = (d: Date) => localeDate(d, intlLocale(), { hour: '2-digit', minute: '2-digit' })
const nextWhen = computed(() => {
  const l = next.value
  if (!l) return ''
  const at = new Date(l.startsAt)
  return `${localeDate(at, intlLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}, ${time(at)}–${time(new Date(at.getTime() + l.durationMinutes * 60_000))}`
})
</script>

<template>
  <AppPage
    :title="t('online.title')"
    icon="i-lucide-video"
  >
    <div class="flex flex-col gap-6 max-w-3xl w-full">
      <USkeleton
        v-if="status === 'pending' && !data.learning.length"
        class="h-44 rounded-[var(--card-radius)]"
      />

      <template v-else-if="next">
        <!-- The next class -->
        <section
          class="rounded-[var(--card-radius)] p-5 sm:p-6 flex flex-col gap-4"
          :class="next.state === 'LIVE' ? 'bg-error/10 ring-2 ring-error/40' : 'bg-primary/10 ring-2 ring-primary/30'"
          data-testid="online-next"
        >
          <div class="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide">
            <span
              v-if="next.state === 'LIVE'"
              class="size-2.5 rounded-full bg-error animate-pulse"
            />
            <span :class="next.state === 'LIVE' ? 'text-error' : 'text-primary'">{{ next.state === 'LIVE' ? t('online.live') : t('online.nextClass') }}</span>
            <span
              v-if="next.state !== 'LIVE'"
              class="ms-auto text-highlighted normal-case tracking-normal tabular-nums"
            >{{ countdown }}</span>
          </div>
          <div>
            <h2 class="text-2xl font-extrabold text-highlighted">
              {{ next.title }}
            </h2>
            <p class="text-toned mt-1">
              {{ nextWhen }}
            </p>
            <p class="text-sm text-muted mt-0.5">
              {{ [next.place, next.teacher].filter(Boolean).join(' · ') }}
            </p>
            <p
              v-if="next.description"
              class="text-sm text-toned mt-2 whitespace-pre-line"
            >
              {{ next.description }}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <UButton
              v-if="next.meetUrl && next.joinable"
              :href="next.meetUrl"
              target="_blank"
              rel="noopener"
              :label="t('online.join')"
              icon="i-logos-google-meet"
              size="lg"
              :color="next.state === 'LIVE' ? 'error' : 'primary'"
              data-testid="live-join"
            />
            <UButton
              v-else
              :label="t('online.join')"
              icon="i-lucide-lock"
              size="lg"
              color="neutral"
              variant="outline"
              disabled
            />
            <span
              v-if="!next.joinable"
              class="text-sm text-muted"
            >{{ t('online.joinOpens') }}</span>
          </div>
        </section>

        <!-- The ones after it -->
        <section
          v-for="g in later"
          :key="g.label"
          class="flex flex-col gap-2"
        >
          <h2 class="text-sm font-extrabold text-muted uppercase tracking-wide">
            {{ g.label }}
          </h2>
          <div
            class="rounded-[var(--card-radius)] ring-2 ring-default divide-y divide-default overflow-hidden bg-default"
            data-testid="online-coming"
          >
            <OnlineRow
              v-for="l in g.lessons"
              :key="l.id"
              :lesson="l"
            />
          </div>
        </section>
      </template>

      <UEmpty
        v-else
        icon="i-lucide-video-off"
        :title="t('online.noneComing')"
        :description="t('online.noneComingText')"
        :actions="[{ label: t('classes.join'), to: '/profile', color: 'neutral', variant: 'outline' }, { label: t('courses.browse'), to: '/courses', color: 'neutral', variant: 'ghost' }]"
      />
    </div>
  </AppPage>
</template>
