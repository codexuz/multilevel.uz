<script setup lang="ts">
/** One online class (Google Meet): when, where, and Join while it is open (a quarter of an hour before it starts until it ends). */
export interface LiveLesson {
  id: string
  title: string
  description: string | null
  startsAt: string
  durationMinutes: number
  status: string
  state: 'UPCOMING' | 'LIVE' | 'ENDED' | 'CANCELLED'
  joinable: boolean
  meetUrl: string | null
  calendarLink: string | null
  place: string | null
  teacher: string | null
}
const props = defineProps<{ lesson: LiveLesson, manage?: boolean }>()
const emit = defineEmits<{ move: [], cancel: [] }>()
const { t } = useI18n()
const when = computed(() => localeDate(props.lesson.startsAt, intlLocale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))
const badge = computed(() => ({
  UPCOMING: { label: t('online.upcoming'), color: 'neutral' as const },
  LIVE: { label: t('online.live'), color: 'error' as const },
  ENDED: { label: t('online.ended'), color: 'neutral' as const },
  CANCELLED: { label: t('online.cancelled'), color: 'warning' as const }
})[props.lesson.state])
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-3 px-4 py-3"
    :class="lesson.state === 'CANCELLED' || lesson.state === 'ENDED' ? 'opacity-60' : ''"
    data-testid="live-row"
  >
    <div class="size-10 shrink-0 rounded-lg bg-primary/10 text-primary grid place-items-center">
      <UIcon
        name="i-lucide-video"
        class="size-5"
      />
    </div>
    <div class="min-w-0 flex-1">
      <p class="font-medium text-highlighted flex flex-wrap items-center gap-2">
        {{ lesson.title }}
        <UBadge
          :label="badge.label"
          :color="badge.color"
          variant="subtle"
          size="sm"
        />
      </p>
      <p class="text-xs text-muted">
        {{ when }} · {{ t('online.minutes', { n: lesson.durationMinutes }) }}<template v-if="lesson.place">
          · {{ lesson.place }}
        </template><template v-if="lesson.teacher && !manage">
          · {{ lesson.teacher }}
        </template>
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <UButton
        v-if="lesson.meetUrl && (lesson.joinable || manage)"
        :href="lesson.meetUrl"
        target="_blank"
        rel="noopener"
        :label="t('online.join')"
        icon="i-logos-google-meet"
        size="sm"
        :color="lesson.joinable ? 'primary' : 'neutral'"
        :variant="lesson.joinable ? 'solid' : 'outline'"
        data-testid="live-join"
      />
      <span
        v-else-if="lesson.state === 'UPCOMING'"
        class="text-xs text-muted"
      >{{ t('online.joinOpens') }}</span>
      <template v-if="manage && lesson.status === 'SCHEDULED' && lesson.state !== 'ENDED'">
        <UButton
          :label="t('online.move')"
          icon="i-lucide-calendar-clock"
          size="sm"
          color="neutral"
          variant="ghost"
          @click="emit('move')"
        />
        <UButton
          :label="t('online.cancel')"
          icon="i-lucide-x"
          size="sm"
          color="neutral"
          variant="ghost"
          @click="emit('cancel')"
        />
      </template>
    </div>
  </div>
</template>
