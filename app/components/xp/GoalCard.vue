<script setup lang="ts">
import type { XpSummary } from '~/composables/useXp'

/**
 * The daily goal: today's XP against it, the streak with the last seven days (a flame for each day
 * with XP), the level with what is left to the next, and the goal to change (10, 30, 50 or 100 XP).
 */
const props = defineProps<{ xp: XpSummary, compact?: boolean }>()
const { t, locale } = useI18n()
const { setGoal } = useXp()

const pct = computed(() => Math.min(100, Math.round(props.xp.today / Math.max(1, props.xp.goal) * 100)))
const met = computed(() => props.xp.today >= props.xp.goal)
const levelPct = computed(() => {
  const span = props.xp.levelTo - props.xp.levelFrom
  return span ? Math.round((props.xp.total - props.xp.levelFrom) / span * 100) : 0
})
const weekday = (d: string) => localeDate(d, locale.value, { weekday: 'short' }).slice(0, 2)
const goals = [10, 30, 50, 100]
const saving = ref(false)
async function choose(g: number) {
  if (g === props.xp.goal) return
  saving.value = true
  await setGoal(g).finally(() => (saving.value = false))
}
</script>

<template>
  <div
    class="flex flex-col gap-4"
    data-testid="xp-goal"
  >
    <div class="flex items-center gap-3">
      <span
        class="grid place-items-center size-12 rounded-2xl shrink-0"
        :class="xp.extendedToday ? 'bg-flame/15 text-flame' : 'bg-elevated text-dimmed'"
      >
        <UIcon
          name="i-lucide-flame"
          class="size-7"
        />
      </span>
      <div class="min-w-0">
        <p class="text-2xl font-extrabold text-highlighted leading-none tabular-nums">
          {{ t('xp.streakDays', { n: xp.streak }, xp.streak) }}
        </p>
        <p class="text-sm text-muted mt-1">
          {{ xp.extendedToday ? t('xp.streakKept') : xp.streak ? t('xp.streakAtRisk') : t('xp.streakStart') }}
        </p>
      </div>
    </div>

    <ol class="grid grid-cols-7 gap-1 text-center">
      <li
        v-for="d in xp.week"
        :key="d.day"
        class="flex flex-col items-center gap-1"
      >
        <span class="text-[11px] font-bold uppercase text-muted">{{ weekday(d.day) }}</span>
        <span
          class="grid place-items-center size-8 rounded-full"
          :class="d.xp ? 'bg-flame text-white' : 'bg-elevated text-dimmed'"
          :title="t('xp.dayXp', { n: d.xp })"
        >
          <UIcon
            :name="d.xp ? 'i-lucide-flame' : 'i-lucide-minus'"
            class="size-4"
          />
        </span>
      </li>
    </ol>

    <div>
      <div class="flex items-baseline justify-between gap-2">
        <p class="font-extrabold text-highlighted flex items-center gap-1.5">
          <UIcon
            name="i-lucide-zap"
            class="size-5 text-xp"
          />{{ t('xp.dailyGoal') }}
        </p>
        <p class="text-sm font-bold tabular-nums text-toned">
          {{ xp.today }} / {{ xp.goal }} XP
        </p>
      </div>
      <div class="mt-2 h-4 rounded-full bg-accented/70 overflow-hidden">
        <div
          class="h-full rounded-full transition-[width] duration-500"
          :class="met ? 'bg-correct' : 'bg-xp'"
          :style="{ width: `${pct}%` }"
        />
      </div>
      <p class="text-xs text-muted mt-1.5">
        {{ met ? t('xp.goalMet') : t('xp.goalLeft', { n: xp.goal - xp.today }) }}
      </p>
    </div>

    <div v-if="!compact">
      <div class="flex items-baseline justify-between text-sm">
        <span class="font-extrabold text-highlighted">{{ t('xp.level', { n: xp.level }) }}</span>
        <span class="text-muted tabular-nums">{{ t('xp.toNext', { n: xp.levelTo - xp.total }) }}</span>
      </div>
      <UProgress
        :model-value="levelPct"
        size="md"
        class="mt-2"
      />
    </div>

    <div>
      <p class="text-xs font-bold text-muted mb-1.5">
        {{ t('xp.changeGoal') }}
      </p>
      <div class="grid grid-cols-4 gap-1.5">
        <button
          v-for="g in goals"
          :key="g"
          type="button"
          class="tile py-1.5 text-sm font-extrabold cursor-pointer"
          :data-state="g === xp.goal ? 'selected' : undefined"
          :disabled="saving"
          @click="choose(g)"
        >
          {{ g }}
        </button>
      </div>
    </div>
  </div>
</template>
