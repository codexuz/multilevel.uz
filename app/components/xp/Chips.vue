<script setup lang="ts">
/**
 * The streak and today's XP in the top bar (students): a flame with the days in a row (lit once today
 * counts) and a bolt with today's XP. Opening it shows the week, the daily goal and the level.
 */
const { t } = useI18n()
const { xp, student, refresh } = useXp()
const route = useRoute()
// Back from a test, a lesson or a game: the numbers may have moved.
watch(() => route.path, () => {
  if (student.value) refresh()
})
</script>

<template>
  <UPopover
    v-if="student && xp"
    :content="{ align: 'end', sideOffset: 8 }"
  >
    <button
      type="button"
      class="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-elevated font-extrabold tabular-nums cursor-pointer focus-visible:outline-2 focus-visible:outline-primary"
      :aria-label="t('xp.chipsLabel', { streak: xp.streak, today: xp.today })"
      data-testid="xp-chips"
    >
      <span
        class="flex items-center gap-0.5"
        :class="xp.extendedToday ? 'text-flame' : 'text-dimmed'"
      >
        <UIcon
          name="i-lucide-flame"
          class="size-5"
        />{{ xp.streak }}
      </span>
      <span class="flex items-center gap-0.5 text-xp ms-1.5">
        <UIcon
          name="i-lucide-zap"
          class="size-5"
        />{{ xp.today }}
      </span>
    </button>
    <template #content>
      <div class="w-80 p-4">
        <XpGoalCard
          :xp="xp"
          compact
        />
      </div>
    </template>
  </UPopover>
</template>
