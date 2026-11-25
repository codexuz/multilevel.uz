<script setup lang="ts">
/**
 * A class's vocabulary for its teacher: one row per student, ranked by this week's XP, with how many
 * cards they know in each deck set to the class, their accuracy and when they last played.
 */
const props = defineProps<{ groupId: string }>()
const { t } = useI18n()

interface Row { id: string, name: string, avatarUrl: string | null, decks: { deckId: string, known: number, seen: number, total: number }[], known: number, accuracy: number | null, lastAt: string | null, weekXp: number }
const { data, status } = await useFetch<{ decks: { id: string, title: string, level: string | null, cards: number }[], students: Row[] }>(() => `/api/groups/${props.groupId}/vocab`, { lazy: true })

const pct = (c: { known: number, total: number }) => (c.total ? Math.round(c.known / c.total * 100) : 0)
const accColor = (a: number | null) => (a == null ? 'text-dimmed' : a >= 80 ? 'text-success' : a >= 60 ? 'text-warning' : 'text-error')
const medal = (i: number, xp: number) => (xp > 0 && i < 3 ? ['bg-xp text-white', 'bg-accented text-highlighted', 'bg-flame/70 text-white'][i] : 'text-muted')
const when = (d: string | null) => (d ? relativeTime(d) : '—')
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-2">
      <p class="text-sm text-muted me-auto">
        {{ t('vocab.classIntro') }}
      </p>
      <UButton
        to="/teacher/vocabulary"
        :label="t('vocab.manageDecks')"
        icon="i-lucide-layers"
        color="neutral"
        variant="outline"
        size="sm"
      />
    </div>

    <USkeleton
      v-if="status === 'pending' && !data"
      class="h-48 rounded-[var(--card-radius)]"
    />
    <UEmpty
      v-else-if="data && !data.decks.length"
      icon="i-lucide-layers"
      :title="t('vocab.classNoDecks')"
      :description="t('vocab.classNoDecksText')"
      :actions="[{ label: t('vocab.manageDecks'), to: '/teacher/vocabulary', icon: 'i-lucide-layers' }]"
    />
    <UEmpty
      v-else-if="data && !data.students.length"
      icon="i-lucide-user-plus"
      :title="t('centre.noStudents')"
      :description="t('centre.noStudentsText')"
    />
    <div
      v-else-if="data"
      class="rounded-[var(--card-radius)] ring-2 ring-default overflow-x-auto bg-default"
      data-testid="class-vocab"
    >
      <table class="w-full text-sm min-w-[40rem]">
        <thead>
          <tr class="text-left text-xs font-extrabold uppercase tracking-wide text-muted border-b-2 border-default">
            <th class="p-3 w-10">
              #
            </th>
            <th class="p-3">
              {{ t('vocab.student') }}
            </th>
            <th class="p-3 text-end whitespace-nowrap">
              {{ t('vocab.weekXp') }}
            </th>
            <th
              v-for="d in data.decks"
              :key="d.id"
              class="p-3 min-w-36"
            >
              <NuxtLink
                :to="`/teacher/vocabulary/${d.id}`"
                class="hover:text-highlighted normal-case tracking-normal text-sm font-bold line-clamp-1"
                :title="d.title"
              >{{ d.title }}</NuxtLink>
              <span class="normal-case tracking-normal font-semibold text-dimmed">{{ t('vocab.cardCount', { n: d.cards }, d.cards) }}</span>
            </th>
            <th class="p-3 text-end">
              {{ t('game.accuracy') }}
            </th>
            <th class="p-3 whitespace-nowrap">
              {{ t('vocab.lastPlayed') }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="(s, i) in data.students"
            :key="s.id"
          >
            <td class="p-3">
              <span
                class="grid place-items-center size-7 rounded-full text-xs font-extrabold tabular-nums"
                :class="medal(i, s.weekXp)"
              >{{ i + 1 }}</span>
            </td>
            <td class="p-3">
              <div class="flex items-center gap-2 min-w-0">
                <UAvatar
                  :src="s.avatarUrl ?? undefined"
                  :alt="s.name"
                  size="sm"
                />
                <span class="font-bold text-highlighted truncate">{{ s.name }}</span>
              </div>
            </td>
            <td class="p-3 text-end">
              <span
                class="inline-flex items-center gap-0.5 font-extrabold tabular-nums"
                :class="s.weekXp ? 'text-xp' : 'text-dimmed'"
              >
                <UIcon
                  name="i-lucide-zap"
                  class="size-4"
                />{{ s.weekXp }}
              </span>
            </td>
            <td
              v-for="c in s.decks"
              :key="c.deckId"
              class="p-3"
            >
              <div
                class="flex items-center gap-2"
                :title="t('vocab.cellTitle', { known: c.known, seen: c.seen, total: c.total })"
              >
                <!-- Known cards in green over the cards seen so far. -->
                <div class="relative h-2.5 flex-1 rounded-full bg-accented/70 overflow-hidden min-w-12">
                  <div
                    class="absolute inset-y-0 start-0 rounded-full bg-primary/35"
                    :style="{ width: `${c.total ? Math.round(c.seen / c.total * 100) : 0}%` }"
                  />
                  <div
                    class="absolute inset-y-0 start-0 rounded-full bg-correct"
                    :style="{ width: `${pct(c)}%` }"
                  />
                </div>
                <span
                  class="text-xs font-bold tabular-nums whitespace-nowrap"
                  :class="c.seen ? 'text-toned' : 'text-dimmed'"
                >{{ c.known }}/{{ c.total }}</span>
              </div>
            </td>
            <td
              class="p-3 text-end font-bold tabular-nums"
              :class="accColor(s.accuracy)"
            >
              {{ s.accuracy == null ? '—' : `${s.accuracy}%` }}
            </td>
            <td class="p-3 text-muted whitespace-nowrap">
              {{ when(s.lastAt) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
