<script setup lang="ts">
import { uploadFile } from '~/services/http'

/**
 * Instant AI feedback on Writing or Speaking: an estimated score out of 75, each task's (or part's)
 * criteria, corrections and a better version. For a saved attempt (`attemptId`), for essays just
 * written in practice (`slug`, `part`, `essays`), for answers just recorded in practice (`slug`,
 * `part`, `recordings`, uploaded first), or one already asked for (`reviewId`). Asks, waits while
 * it is written (polling), then shows it; Speaking shows what was heard, too.
 */
const props = withDefaults(defineProps<{
  skill?: 'WRITING' | 'SPEAKING'
  attemptId?: string
  reviewId?: string
  slug?: string
  part?: number | null
  essays?: Record<string, string>
  recordings?: { partId: string, blob: Blob, durationSeconds: number }[]
}>(), { skill: 'WRITING' })

type Correction = { original: string, corrected: string, why: string }
interface Review {
  id: string
  status: 'PENDING' | 'DONE' | 'FAILED'
  score: number | null
  cefrLevel: string | null
  error: string | null
  summary?: string
  strengths?: string[]
  priorities?: string[]
  tasks?: { taskId: string, label: string, wordCount: number, minWords: number, criteria: Record<string, number>, level: string | null, comment: string, corrections: Correction[], betterSentence: string }[]
  parts?: { partId: string, label: string, durationSeconds: number | null, transcript: string, criteria: Record<string, number>, level: string | null, comment: string, corrections: Correction[], betterAnswer: string }[]
}
interface Status { enabled: boolean, allowance: { limit: number | null, used: number, left: number | null, period: 'month' | 'day' | null } | null }

const { loggedIn, isPremium } = useMe()
const route = useRoute()
const toast = useToast()
const { data: status, refresh: refreshStatus } = useFetch<Status>('/api/ai/status', { key: 'ai-status' })

const review = ref<Review | null>(null)
const starting = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function poll(id: string) {
  clearTimeout(timer)
  try {
    review.value = await $fetch<Review>(`/api/ai/reviews/${id}`)
  } catch {
    // A dropped connection: keep waiting.
  }
  if (!review.value || review.value.status === 'PENDING') timer = setTimeout(() => poll(id), 3000)
  else refreshStatus()
}
onBeforeUnmount(() => clearTimeout(timer))

onMounted(async () => {
  if (props.reviewId) return poll(props.reviewId)
  if (!props.attemptId || !loggedIn.value) return
  const existing = await $fetch<Review | null>('/api/ai/reviews', { query: { attemptId: props.attemptId } }).catch(() => null)
  if (existing) {
    review.value = existing
    if (existing.status === 'PENDING') poll(existing.id)
  }
})

async function practiceBody() {
  if (props.skill === 'WRITING') return { slug: props.slug, part: props.part ?? null, essays: Object.entries(props.essays ?? {}).map(([taskId, text]) => ({ taskId, text: text ?? '' })) }
  // Recorded in the browser: uploaded first, so the server can read them from storage.
  const recordings = []
  for (const r of props.recordings ?? []) {
    const file = await uploadFile(new File([r.blob], `speaking-${r.partId}.webm`, { type: r.blob.type || 'audio/webm' }), { purpose: 'recording' })
    recordings.push({ partId: r.partId, audioRef: file.url, durationSeconds: r.durationSeconds })
  }
  return { slug: props.slug, part: props.part ?? null, recordings }
}

async function start() {
  starting.value = true
  try {
    const body = props.attemptId ? { attemptId: props.attemptId } : await practiceBody()
    const { id } = await $fetch<{ id: string }>(`/api/ai/${props.skill === 'SPEAKING' ? 'speaking' : 'writing'}`, { method: 'POST', body })
    review.value = { id, status: 'PENDING', score: null, cefrLevel: null, error: null }
    poll(id)
  } catch (e: any) {
    toast.add({ title: 'No AI feedback yet', description: e?.data?.message || 'Please try again.', color: e?.statusCode === 402 ? 'warning' : 'error' })
    refreshStatus()
  } finally {
    starting.value = false
  }
}

const left = computed(() => status.value?.allowance?.left)
const leftText = computed(() => {
  const a = status.value?.allowance
  if (!a || a.left == null) return ''
  return `${a.left} of ${a.limit} left ${a.period === 'day' ? 'today' : 'this month'}`
})
const speaking = computed(() => !!review.value?.parts || props.skill === 'SPEAKING')
const CRITERIA = computed(() => speaking.value
  ? [{ key: 'fluency', label: 'Fluency' }, { key: 'vocabulary', label: 'Vocabulary' }, { key: 'grammar', label: 'Grammar' }, { key: 'taskAchievement', label: 'Task achievement' }]
  : [{ key: 'taskAchievement', label: 'Task achievement' }, { key: 'organisation', label: 'Organisation' }, { key: 'vocabulary', label: 'Vocabulary' }, { key: 'grammar', label: 'Grammar' }])
/** Tasks or parts, alike: what each card shows. */
const items = computed(() => review.value?.parts
  ? review.value.parts.map(p => ({ id: p.partId, label: p.label, level: p.level, criteria: p.criteria, comment: p.comment, corrections: p.corrections, better: p.betterAnswer, meta: p.durationSeconds ? `${p.durationSeconds}s` : '', warn: false, transcript: p.transcript }))
  : (review.value?.tasks ?? []).map(t => ({ id: t.taskId, label: t.label, level: t.level, criteria: t.criteria, comment: t.comment, corrections: t.corrections, better: t.betterSentence, meta: `${t.wordCount} / ${t.minWords}+ words`, warn: t.wordCount < t.minWords, transcript: null as string | null })))
const intro = computed(() => speaking.value
  ? 'An estimated score out of 75 from what you said: how each part did on fluency, vocabulary, grammar and the task, with corrections. About a minute.'
  : 'An estimated score out of 75, how each task did on the four criteria, and the corrections that matter most. About a minute.')
const levelText = (l: string | null) => (l === 'A2' || l === 'A1' ? 'Below B1' : l ? `CEFR ${l}` : '')
</script>

<template>
  <div
    v-if="status?.enabled"
    class="flex flex-col gap-4"
  >
    <!-- Not asked yet -->
    <UCard v-if="!review || review.status === 'FAILED'">
      <div class="flex flex-col sm:flex-row sm:items-center gap-4">
        <div class="size-12 shrink-0 rounded-xl bg-primary/10 text-primary grid place-items-center">
          <UIcon
            name="i-lucide-sparkles"
            class="size-6"
          />
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-highlighted">
            Instant AI feedback
          </p>
          <p class="text-sm text-muted text-pretty">
            {{ review?.status === 'FAILED' ? review.error : intro }}
          </p>
          <p
            v-if="loggedIn && leftText"
            class="text-xs text-dimmed mt-1"
          >
            {{ leftText }}
          </p>
        </div>
        <UButton
          v-if="!loggedIn"
          :to="`/login?next=${encodeURIComponent(route.fullPath)}`"
          label="Sign in for AI feedback"
          icon="i-lucide-log-in"
          class="justify-center"
        />
        <UButton
          v-else-if="left === 0"
          :to="isPremium ? undefined : `/pricing?from=${encodeURIComponent(route.fullPath)}`"
          :disabled="isPremium"
          :label="isPremium ? 'More tomorrow' : 'Get more with Premium'"
          icon="i-lucide-sparkles"
          color="neutral"
          variant="outline"
          class="justify-center"
        />
        <UButton
          v-else
          :label="review?.status === 'FAILED' ? 'Try again' : 'Get AI feedback'"
          icon="i-lucide-wand-sparkles"
          :loading="starting"
          class="justify-center"
          @click="start"
        />
      </div>
    </UCard>

    <!-- Being written -->
    <UCard v-else-if="review.status === 'PENDING'">
      <div class="flex items-center gap-4">
        <UIcon
          name="i-lucide-loader-circle"
          class="size-8 text-primary animate-spin shrink-0"
        />
        <div>
          <p class="font-semibold text-highlighted">
            Reading your writing…
          </p>
          <p class="text-sm text-muted">
            Usually under a minute. You can stay here; it appears by itself.
          </p>
        </div>
      </div>
    </UCard>

    <!-- The feedback -->
    <template v-else>
      <UCard>
        <div class="flex items-center justify-between gap-3 mb-3">
          <p class="font-semibold text-highlighted flex items-center gap-2">
            <UIcon
              name="i-lucide-sparkles"
              class="text-primary"
            />AI feedback
          </p>
          <UBadge
            label="Estimate"
            color="neutral"
            variant="subtle"
            size="sm"
          />
        </div>
        <div class="rounded-xl bg-gradient-to-br from-[#5870f5] to-[#8b9cff] px-6 py-5 text-white flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p class="text-5xl font-bold tabular-nums leading-none whitespace-nowrap">
              {{ review.score }}<span class="text-xl font-semibold opacity-80"> / 75</span>
            </p>
            <p class="mt-2 font-medium">
              {{ levelText(review.cefrLevel) }}
            </p>
          </div>
          <p class="text-xs text-white/80 sm:text-right sm:max-w-44">
            An AI estimate to guide you, not an examiner's mark.
          </p>
        </div>
        <p
          v-if="review.summary"
          class="mt-4 text-sm text-toned text-pretty"
        >
          {{ review.summary }}
        </p>
        <div
          v-if="review.strengths?.length || review.priorities?.length"
          class="mt-4 grid sm:grid-cols-2 gap-3"
        >
          <div
            v-if="review.strengths?.length"
            class="rounded-lg bg-success/10 px-4 py-3"
          >
            <p class="text-xs font-semibold text-success mb-1.5">
              Keep doing
            </p>
            <ul class="text-sm text-toned flex flex-col gap-1 list-disc ps-4">
              <li
                v-for="s in review.strengths"
                :key="s"
              >
                {{ s }}
              </li>
            </ul>
          </div>
          <div
            v-if="review.priorities?.length"
            class="rounded-lg bg-warning/10 px-4 py-3"
          >
            <p class="text-xs font-semibold text-warning mb-1.5">
              Work on first
            </p>
            <ul class="text-sm text-toned flex flex-col gap-1 list-disc ps-4">
              <li
                v-for="p in review.priorities"
                :key="p"
              >
                {{ p }}
              </li>
            </ul>
          </div>
        </div>
      </UCard>

      <UCard
        v-for="t in items"
        :key="t.id"
      >
        <template #header>
          <div class="flex items-center gap-2">
            <span class="font-semibold">{{ t.label }}</span>
            <UBadge
              v-if="t.level"
              :label="levelText(t.level)"
              color="primary"
              variant="soft"
              size="sm"
            />
            <span
              class="ms-auto text-xs tabular-nums"
              :class="t.warn ? 'text-warning' : 'text-muted'"
            >{{ t.meta }}</span>
          </div>
        </template>
        <div class="flex flex-col gap-4">
          <ul class="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
            <li
              v-for="c in CRITERIA"
              :key="c.key"
              class="text-sm"
            >
              <div class="flex justify-between mb-1">
                <span class="text-toned">{{ c.label }}</span>
                <span class="font-semibold tabular-nums text-highlighted">{{ t.criteria[c.key] }}/5</span>
              </div>
              <div class="h-1.5 rounded-full bg-elevated overflow-hidden">
                <div
                  class="h-full rounded-full bg-primary"
                  :style="{ width: `${(t.criteria[c.key] ?? 0) * 20}%` }"
                />
              </div>
            </li>
          </ul>
          <p class="text-sm text-toned text-pretty">
            {{ t.comment }}
          </p>
          <details
            v-if="t.transcript"
            class="rounded-lg ring ring-default px-3 py-2 text-sm"
          >
            <summary class="cursor-pointer text-xs font-semibold text-muted">
              What we heard
            </summary>
            <p class="mt-2 text-toned leading-6">
              {{ t.transcript }}
            </p>
          </details>
          <div v-if="t.corrections.length">
            <p class="text-xs font-semibold text-muted mb-2">
              Corrections
            </p>
            <ul class="flex flex-col divide-y divide-default rounded-lg ring ring-default">
              <li
                v-for="(c, i) in t.corrections"
                :key="i"
                class="px-3 py-2.5 text-sm"
              >
                <p>
                  <span class="line-through decoration-error/70 text-muted">{{ c.original }}</span>
                  <UIcon
                    name="i-lucide-arrow-right"
                    class="size-3.5 mx-1.5 align-[-2px] text-dimmed"
                  />
                  <span class="font-medium text-success">{{ c.corrected }}</span>
                </p>
                <p class="text-xs text-muted mt-0.5">
                  {{ c.why }}
                </p>
              </li>
            </ul>
          </div>
          <div
            v-if="t.better"
            class="rounded-lg bg-elevated px-4 py-3"
          >
            <p class="text-xs font-semibold text-muted mb-1">
              One step up
            </p>
            <p class="text-sm text-highlighted font-serif leading-6">
              {{ t.better }}
            </p>
          </div>
        </div>
      </UCard>
    </template>
  </div>
</template>
