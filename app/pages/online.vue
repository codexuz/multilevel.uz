<script setup lang="ts">
import type { LiveLesson } from '~/components/online/Row.vue'

/**
 * Online classes on Google Meet: those of my classes and courses (Join opens a quarter of an hour
 * before they start), and, as a teacher, those I hold.
 */
const { t } = useI18n()
useSeoMeta({ title: () => t('online.title'), robots: 'noindex' })
const { me } = useMe()
const { data, status, refresh } = await useFetch<{ learning: LiveLesson[], teaching: LiveLesson[] }>('/api/me/live-lessons', { default: () => ({ learning: [], teaching: [] }) })
// Refreshed every minute, so Join opens on time.
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => (timer = setInterval(() => refresh(), 60_000)))
onBeforeUnmount(() => clearInterval(timer))

const coming = (list: LiveLesson[]) => list.filter(l => l.state === 'UPCOMING' || l.state === 'LIVE').sort((a, b) => a.startsAt.localeCompare(b.startsAt))
const past = (list: LiveLesson[]) => list.filter(l => l.state === 'ENDED' || l.state === 'CANCELLED').sort((a, b) => b.startsAt.localeCompare(a.startsAt)).slice(0, 10)
const teachingComing = computed(() => coming(data.value.teaching))
const learningComing = computed(() => coming(data.value.learning))
const learningPast = computed(() => past(data.value.learning))
</script>

<template>
  <AppPage
    :title="t('online.title')"
    icon="i-lucide-video"
  >
    <div class="flex flex-col gap-6 max-w-3xl w-full">
      <section
        v-if="me?.teaches"
        class="flex flex-col gap-2"
      >
        <div class="flex items-center justify-between gap-2">
          <h2 class="font-semibold text-highlighted">
            {{ t('online.teaching') }}
          </h2>
          <UButton
            to="/classes"
            :label="t('online.scheduleInClass')"
            icon="i-lucide-plus"
            size="sm"
            color="neutral"
            variant="outline"
          />
        </div>
        <div
          v-if="teachingComing.length"
          class="rounded-xl ring ring-default divide-y divide-default overflow-hidden"
        >
          <OnlineRow
            v-for="l in teachingComing"
            :key="l.id"
            :lesson="l"
          />
        </div>
        <p
          v-else
          class="text-sm text-muted"
        >
          {{ t('online.noneTeaching') }}
        </p>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="font-semibold text-highlighted">
          {{ t('online.coming') }}
        </h2>
        <USkeleton
          v-if="status === 'pending' && !data.learning.length"
          class="h-20 rounded-xl"
        />
        <div
          v-else-if="learningComing.length"
          class="rounded-xl ring ring-default divide-y divide-default overflow-hidden"
          data-testid="online-coming"
        >
          <OnlineRow
            v-for="l in learningComing"
            :key="l.id"
            :lesson="l"
          />
        </div>
        <UEmpty
          v-else
          icon="i-lucide-video-off"
          :title="t('online.noneComing')"
          :description="t('online.noneComingText')"
          :actions="[{ label: t('classes.join'), to: '/profile', color: 'neutral', variant: 'outline' }, { label: t('courses.browse'), to: '/courses', color: 'neutral', variant: 'ghost' }]"
          variant="naked"
        />
      </section>

      <section
        v-if="learningPast.length"
        class="flex flex-col gap-2"
      >
        <h2 class="font-semibold text-highlighted">
          {{ t('online.past') }}
        </h2>
        <div class="rounded-xl ring ring-default divide-y divide-default overflow-hidden">
          <OnlineRow
            v-for="l in learningPast"
            :key="l.id"
            :lesson="l"
          />
        </div>
      </section>
    </div>
  </AppPage>
</template>
