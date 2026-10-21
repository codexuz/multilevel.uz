<script setup lang="ts">
/**
 * Where marks are lost, from what the user has done: the weak spots to work on next (each with a
 * part to practise), and per skill the score over time and how each task type or criterion goes.
 * Hidden until there is something to show.
 */
interface Practise { slug: string, title: string, skill: string, part: number, done: boolean, locked: boolean }
interface Focus { skill: string, kind: 'TYPE' | 'CRITERION', key: string, label: string, detail: string, practise: Practise | null }
interface Objective { skill: string, answers: number, share: number, types: { type: string, label: string, total: number, share: number }[], parts: { part: number, total: number, share: number }[] }
interface Criteria { reviews: number, criteria: { key: string, label: string, average: number | null }[], tasks: { number: number, label: string, average: number, reviews: number }[], priorities: string[] }
interface Insights { skills: Objective[], writing: Criteria, speaking: Criteria, trend: Record<string, { score: number, at: string }[]>, focus: Focus[] }

const { data } = await useFetch<Insights>('/api/me/insights', { lazy: true, server: false })

const practiseLink = (p: Practise) => `/tests/${p.slug}/${p.skill.toLowerCase()}?part=${p.part}`
const shareColor = (share: number) => (share >= 80 ? 'success' : share >= 60 ? 'primary' : share >= 40 ? 'warning' : 'error')
const markColor = (avg: number) => shareColor((avg / 5) * 100)

interface Card { skill: string, trend: { score: number, at: string }[], objective?: Objective, criteria?: Criteria }
const cards = computed<Card[]>(() => {
  const d = data.value
  if (!d) return []
  return (['LISTENING', 'READING', 'WRITING', 'SPEAKING'] as const).map((skill) => {
    const objective = d.skills.find(s => s.skill === skill && s.answers)
    const criteria = skill === 'WRITING' ? d.writing : skill === 'SPEAKING' ? d.speaking : undefined
    return { skill, trend: d.trend[skill] ?? [], objective, criteria: criteria?.reviews ? criteria : undefined }
  }).filter(c => c.trend.length || c.objective || c.criteria)
})

/** A small line of the last scores, scaled to their own range (at least 10 points) so changes show. */
function sparkline(points: { score: number }[]) {
  if (points.length < 2) return ''
  const w = 96
  const h = 28
  const scores = points.map(p => p.score)
  const mid = (Math.max(...scores) + Math.min(...scores)) / 2
  const span = Math.max(10, Math.max(...scores) - Math.min(...scores))
  const y = (s: number) => h - ((s - (mid - span / 2)) / span) * h
  return points.map((p, i) => `${i ? 'L' : 'M'}${((i / (points.length - 1)) * w).toFixed(1)},${y(p.score).toFixed(1)}`).join(' ')
}
function change(points: { score: number }[]) {
  if (points.length < 2) return null
  const last = points[points.length - 1]!.score
  const before = points.slice(0, -1)
  return Math.round(last - before.reduce((a, p) => a + p.score, 0) / before.length)
}
</script>

<template>
  <div
    v-if="cards.length"
    class="flex flex-col gap-4"
  >
    <UCard
      v-if="data?.focus.length"
      :ui="{ body: 'p-0 sm:p-0' }"
    >
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon
            name="i-lucide-crosshair"
            class="size-5 text-primary"
          />
          <h2 class="font-semibold text-highlighted">
            Work on these next
          </h2>
        </div>
        <p class="text-sm text-muted mt-1">
          Where you lose the most marks lately, with a part to practise for each.
        </p>
      </template>
      <ul class="divide-y divide-default">
        <li
          v-for="f in data.focus"
          :key="`${f.skill}-${f.key}`"
          class="flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-6 py-3"
        >
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <div class="size-10 shrink-0 rounded-xl bg-elevated grid place-items-center">
              <img
                :src="SKILL_ART[f.skill]"
                alt=""
                class="size-6"
              >
            </div>
            <div class="min-w-0">
              <p class="font-medium text-highlighted">
                {{ skillLabel(f.skill) }}: {{ f.label }}
              </p>
              <p class="text-xs text-muted">
                {{ f.detail }}
              </p>
            </div>
          </div>
          <div
            v-if="f.practise"
            class="flex items-center justify-between sm:justify-end gap-2"
          >
            <span class="text-xs text-dimmed truncate sm:max-w-48">
              {{ partName(f.practise.skill, f.practise.part) }} · {{ f.practise.title }}
            </span>
            <UButton
              :to="practiseLink(f.practise)"
              :label="f.practise.done ? 'Practise again' : 'Practise'"
              :icon="f.practise.locked ? 'i-lucide-lock' : 'i-lucide-play'"
              size="sm"
              :color="f.practise.locked ? 'neutral' : 'primary'"
              :variant="f.practise.locked ? 'outline' : 'solid'"
            />
          </div>
        </li>
      </ul>
    </UCard>

    <div class="grid sm:grid-cols-2 gap-4">
      <UCard
        v-for="c in cards"
        :key="c.skill"
      >
        <div class="flex items-start gap-3">
          <img
            :src="SKILL_ART[c.skill]"
            alt=""
            class="size-8 shrink-0"
          >
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-highlighted">
              {{ skillLabel(c.skill) }}
            </p>
            <p
              v-if="c.trend.length"
              class="text-xs text-muted"
            >
              Last {{ fmtScore(c.trend[c.trend.length - 1]!.score) }}/75
              <template v-if="change(c.trend) != null">
                · <span :class="change(c.trend)! >= 0 ? 'text-success' : 'text-error'">{{ change(c.trend)! >= 0 ? '+' : '' }}{{ change(c.trend) }}</span> on your average before
              </template>
            </p>
            <p
              v-else-if="c.objective"
              class="text-xs text-muted"
            >
              {{ c.objective.share }}% right over {{ c.objective.answers }} questions
            </p>
            <p
              v-else-if="c.criteria"
              class="text-xs text-muted"
            >
              From {{ c.criteria.reviews }} AI {{ c.criteria.reviews === 1 ? 'review' : 'reviews' }}
            </p>
          </div>
          <svg
            v-if="c.trend.length > 1"
            viewBox="-2 -2 100 32"
            class="w-24 h-8 shrink-0 text-primary"
            role="img"
            :aria-label="`Your last ${c.trend.length} ${skillLabel(c.skill)} scores: ${c.trend.map(t => t.score).join(', ')}`"
          >
            <path
              :d="sparkline(c.trend)"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>

        <div
          v-if="c.objective"
          class="mt-4 grid gap-2.5"
        >
          <div
            v-for="t in c.objective.types.slice(0, 5)"
            :key="t.type"
          >
            <div class="flex justify-between text-sm">
              <span class="text-toned truncate">{{ t.label }}</span>
              <span class="tabular-nums text-highlighted font-medium">{{ t.share }}%<span class="text-xs text-dimmed font-normal"> · {{ t.total }}</span></span>
            </div>
            <UProgress
              :model-value="t.share"
              :color="shareColor(t.share)"
              size="sm"
              class="mt-1"
            />
          </div>
          <p
            v-if="c.objective.types.length > 5"
            class="text-xs text-dimmed"
          >
            and {{ c.objective.types.length - 5 }} more task types you do better on
          </p>
        </div>

        <div
          v-if="c.criteria"
          class="mt-4 grid gap-2.5"
        >
          <template
            v-for="k in c.criteria.criteria"
            :key="k.key"
          >
            <div v-if="k.average != null">
              <div class="flex justify-between text-sm">
                <span class="text-toned">{{ k.label }}</span>
                <span class="tabular-nums text-highlighted font-medium">{{ k.average }}/5</span>
              </div>
              <UProgress
                :model-value="(k.average / 5) * 100"
                :color="markColor(k.average)"
                size="sm"
                class="mt-1"
              />
            </div>
          </template>
          <div
            v-if="c.criteria.tasks.length > 1"
            class="flex flex-wrap gap-1.5"
          >
            <UBadge
              v-for="t in c.criteria.tasks"
              :key="t.number"
              :label="`${t.label} ${t.average}/5`"
              :color="markColor(t.average)"
              variant="soft"
              size="sm"
            />
          </div>
          <div
            v-if="c.criteria.priorities.length"
            class="rounded-lg bg-warning/10 px-3 py-2"
          >
            <p class="text-xs font-semibold text-warning">
              From your last AI review
            </p>
            <ul class="mt-1 text-sm text-toned list-disc ps-4">
              <li
                v-for="p in c.criteria.priorities"
                :key="p"
              >
                {{ p }}
              </li>
            </ul>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
