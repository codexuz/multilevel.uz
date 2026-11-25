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
const emit = defineEmits<{ edit: [], cancel: [] }>()
const { t } = useI18n()
const at = computed(() => new Date(props.lesson.startsAt))
const month = computed(() => localeDate(at.value, intlLocale(), { month: 'short' }))
const time = (d: Date) => localeDate(d, intlLocale(), { hour: '2-digit', minute: '2-digit' })
const span = computed(() => `${localeDate(at.value, intlLocale(), { weekday: 'short' })}, ${time(at.value)}–${time(new Date(at.value.getTime() + props.lesson.durationMinutes * 60_000))}`)
const badge = computed(() => ({
  UPCOMING: null,
  LIVE: { label: t('online.live'), color: 'error' as const },
  ENDED: { label: t('online.ended'), color: 'neutral' as const },
  CANCELLED: { label: t('online.cancelled'), color: 'warning' as const }
})[props.lesson.state])
const editable = computed(() => props.manage && props.lesson.status === 'SCHEDULED' && props.lesson.state !== 'ENDED')
</script>

<template>
  <div
    class="flex flex-wrap sm:flex-nowrap items-center gap-3 px-4 py-3"
    :class="lesson.state === 'CANCELLED' || lesson.state === 'ENDED' ? 'opacity-60' : ''"
    data-testid="live-row"
  >
    <div
      class="w-12 shrink-0 rounded-lg text-center py-1 leading-tight"
      :class="lesson.state === 'LIVE' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'"
    >
      <p class="text-[11px] font-extrabold uppercase">
        {{ month }}
      </p>
      <p class="text-lg font-extrabold tabular-nums">
        {{ localeDate(at, intlLocale(), { day: 'numeric' }) }}
      </p>
    </div>
    <div class="min-w-0 flex-1">
      <p
        class="font-bold text-highlighted flex flex-wrap items-center gap-2"
        :class="lesson.state === 'CANCELLED' ? 'line-through decoration-1' : ''"
      >
        {{ lesson.title }}
        <UBadge
          v-if="badge"
          :label="badge.label"
          :color="badge.color"
          variant="subtle"
          size="sm"
        />
      </p>
      <p class="text-xs text-muted">
        {{ span }} · {{ t('online.minutes', { n: lesson.durationMinutes }) }}<template v-if="lesson.place">
          · {{ lesson.place }}
        </template><template v-if="lesson.teacher && !manage">
          · {{ lesson.teacher }}
        </template>
      </p>
      <p
        v-if="lesson.description"
        class="text-xs text-toned mt-0.5 line-clamp-2"
      >
        {{ lesson.description }}
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-1.5 ms-auto">
      <UButton
        v-if="lesson.meetUrl && (lesson.joinable || manage) && lesson.state !== 'ENDED'"
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
        v-else-if="lesson.state === 'UPCOMING' && !manage"
        class="text-xs text-muted"
      >{{ t('online.joinOpens') }}</span>
      <template v-if="editable">
        <UButton
          icon="i-lucide-pencil"
          :label="t('online.edit')"
          size="sm"
          color="neutral"
          variant="ghost"
          data-testid="live-edit"
          @click="emit('edit')"
        />
        <UTooltip :text="t('online.cancelClass')">
          <UButton
            icon="i-lucide-calendar-x"
            :aria-label="t('online.cancelClass')"
            size="sm"
            color="error"
            variant="ghost"
            data-testid="live-cancel"
            @click="emit('cancel')"
          />
        </UTooltip>
      </template>
    </div>
  </div>
</template>
