<script setup lang="ts">
import type { MyGroup } from '~/composables/useMyGroups'

/** One of my groups: its teacher, what is waiting (work to do, the next online class), and the way in. */
const props = defineProps<{ group: MyGroup, compact?: boolean }>()
const { t } = useI18n()
const next = computed(() => props.group.nextClass)
const when = computed(() => (next.value ? localeDate(next.value.startsAt, intlLocale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''))
</script>

<template>
  <NuxtLink
    :to="`/groups/${group.id}`"
    class="tile p-4 flex flex-col gap-3 text-start hover:bg-elevated/50 focus-visible:outline-2 focus-visible:outline-primary"
    data-testid="group-card"
  >
    <div class="flex items-start gap-3">
      <span class="grid place-items-center size-11 rounded-lg bg-primary/10 text-primary shrink-0">
        <UIcon
          name="i-lucide-users"
          class="size-6"
        />
      </span>
      <div class="min-w-0 flex-1">
        <p class="font-extrabold text-highlighted truncate">
          {{ group.name }}
        </p>
        <p class="text-sm text-muted truncate">
          {{ group.teacher.name }} · {{ t('groups.members', { n: group.members }, group.members) }}
        </p>
      </div>
      <UBadge
        :label="group.exam === 'IELTS' ? 'IELTS' : (group.level || 'CEFR')"
        color="neutral"
        variant="subtle"
      />
    </div>
    <div class="flex flex-wrap gap-2 text-xs font-bold">
      <span
        class="inline-flex items-center gap-1 rounded-md px-2 py-1"
        :class="group.overdue ? 'bg-error/10 text-error' : group.todo ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'"
      >
        <UIcon
          :name="group.todo ? 'i-lucide-list-todo' : 'i-lucide-circle-check'"
          class="size-3.5"
        />
        {{ group.todo ? t('groups.todo', { n: group.todo }, group.todo) : t('groups.allDone') }}
      </span>
      <span
        v-if="next"
        class="inline-flex items-center gap-1 rounded-md px-2 py-1"
        :class="next.state === 'LIVE' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'"
      >
        <UIcon
          name="i-lucide-video"
          class="size-3.5"
        />
        {{ next.state === 'LIVE' ? t('online.live') : when }}
      </span>
      <span
        v-if="group.decks && !compact"
        class="inline-flex items-center gap-1 rounded-md px-2 py-1 bg-elevated text-toned"
      >
        <UIcon
          name="i-lucide-layers"
          class="size-3.5"
        />
        {{ t('groups.decks', { n: group.decks }, group.decks) }}
      </span>
    </div>
  </NuxtLink>
</template>
