<script setup lang="ts">
import type { LiveLesson } from '~/components/online/Row.vue'

/**
 * A teacher's online classes across their classes and courses: the coming ones by day, each to edit
 * (title, notes, day, time, length) or cancel, and the past and cancelled ones. New ones are made
 * for a class here or on its page.
 */
definePageMeta({ middleware: 'teacher', layout: 'teacher' })
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
useSeoMeta({ title: () => t('nav.online'), robots: 'noindex' })
const { cancelClass } = useOnlineClasses()

const { data, refresh } = await useFetch<{ teaching: LiveLesson[] }>('/api/me/live-lessons', { default: () => ({ teaching: [] }) })
const { data: classesData } = await useFetch<{ classes: Array<{ id: string, name: string, archived: boolean }> }>('/api/classes', { default: () => ({ classes: [] }) })
const activeGroups = computed(() => classesData.value.classes.filter(c => !c.archived))
const connected = ref(false)
// Join opens on time.
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => (timer = setInterval(() => refresh(), 60_000)))
onBeforeUnmount(() => clearInterval(timer))

const upcoming = computed(() => data.value.teaching.filter(l => l.state === 'UPCOMING' || l.state === 'LIVE').sort((a, b) => a.startsAt.localeCompare(b.startsAt)))
const past = computed(() => data.value.teaching.filter(l => l.state === 'ENDED'))
const cancelled = computed(() => data.value.teaching.filter(l => l.state === 'CANCELLED'))
const view = computed<'upcoming' | 'past' | 'cancelled'>({
  get: () => (route.query.view === 'past' || route.query.view === 'cancelled' ? route.query.view : 'upcoming'),
  set: v => router.replace({ query: { ...route.query, view: v === 'upcoming' ? undefined : v } })
})
const tabs = computed(() => [
  { label: t('online.tabUpcoming'), value: 'upcoming', badge: upcoming.value.length || undefined },
  { label: t('online.tabPast'), value: 'past' },
  { label: t('online.tabCancelled'), value: 'cancelled' }
])

/** The coming classes under their day: Today, Tomorrow, then the date. */
const byDay = computed(() => {
  const today = siteDay(Date.now())
  const tomorrow = siteDay(Date.now() + 864e5)
  const out: { label: string, lessons: LiveLesson[] }[] = []
  for (const l of upcoming.value) {
    const d = siteDay(l.startsAt)
    const label = d <= today ? t('online.today') : d === tomorrow ? t('online.tomorrow') : localeDate(l.startsAt, intlLocale(), { weekday: 'long', day: 'numeric', month: 'long' })
    const g = out.at(-1)
    if (g?.label === label) g.lessons.push(l)
    else out.push({ label, lessons: [l] })
  }
  return out
})
const list = computed(() => (view.value === 'past' ? past.value : cancelled.value))

const modalOpen = ref(false)
const editing = ref<LiveLesson | null>(null)
function openModal(l: LiveLesson | null) {
  editing.value = l
  modalOpen.value = true
}
async function cancel(l: LiveLesson) {
  if (await cancelClass(l)) await refresh()
}
</script>

<template>
  <AppPage
    :title="t('nav.online')"
    icon="i-lucide-calendar-clock"
  >
    <template #actions>
      <UButton
        :label="t('online.schedule')"
        icon="i-lucide-plus"
        :disabled="!activeGroups.length || !connected"
        data-testid="schedule-live"
        @click="openModal(null)"
      />
    </template>

    <div class="flex flex-col gap-4 max-w-4xl">
      <OnlineGoogleConnect
        next="/teacher/classes"
        @change="c => connected = c"
      />

      <UTabs
        v-model="view"
        :items="tabs"
        :content="false"
        class="w-full sm:w-fit"
        data-testid="online-view"
      />

      <template v-if="view === 'upcoming'">
        <section
          v-for="g in byDay"
          :key="g.label"
          class="flex flex-col gap-2"
        >
          <h2 class="text-sm font-extrabold text-muted uppercase tracking-wide">
            {{ g.label }}
          </h2>
          <div class="rounded-[var(--card-radius)] ring-2 ring-default divide-y divide-default overflow-hidden bg-default">
            <OnlineRow
              v-for="l in g.lessons"
              :key="l.id"
              :lesson="l"
              manage
              @edit="openModal(l)"
              @cancel="cancel(l)"
            />
          </div>
        </section>
        <UEmpty
          v-if="!upcoming.length"
          icon="i-lucide-video"
          :title="t('online.none')"
          :description="t('online.noneText')"
          :actions="activeGroups.length ? [{ label: t('online.schedule'), icon: 'i-lucide-plus', disabled: !connected, onClick: () => openModal(null) }] : [{ label: t('tdash.newClass'), to: '/classes?new=1' }]"
        />
      </template>

      <template v-else>
        <div
          v-if="list.length"
          class="rounded-[var(--card-radius)] ring-2 ring-default divide-y divide-default overflow-hidden bg-default"
        >
          <OnlineRow
            v-for="l in list"
            :key="l.id"
            :lesson="l"
            manage
          />
        </div>
        <UEmpty
          v-else
          icon="i-lucide-calendar"
          :title="view === 'past' ? t('online.nonePast') : t('online.noneCancelled')"
          variant="naked"
        />
      </template>
    </div>

    <OnlineLessonModal
      v-model:open="modalOpen"
      :lesson="editing"
      :groups="activeGroups"
      @saved="refresh()"
    />
  </AppPage>
</template>
