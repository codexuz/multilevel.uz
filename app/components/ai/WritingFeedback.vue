<script setup lang="ts">
import { uploadFile } from '~/services/http'

const { t: tr } = useI18n()

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
  recordings?: { partId: string, position: number, blob: Blob, durationSeconds: number, audioRef?: Promise<string | null> }[]
}>(), { skill: 'WRITING' })

type Correction = { original: string, corrected: string, why: string }
interface Review {
  id: string
  status: 'PENDING' | 'DONE' | 'FAILED'
  score: number | null
  /** IELTS: the band, with the criteria marked out of 9 (`scale`). */
  band?: number | null
  scale?: number
  cefrLevel: string | null
  error: string | null
  summary?: string
  strengths?: string[]
  priorities?: string[]
  tasks?: { taskId: string, label: string, wordCount: number, minWords: number, criteria: Record<string, number>, band?: number | null, level: string | null, comment: string, corrections: Correction[], betterSentence: string }[]
  parts?: {
    partId: string
    label: string
    durationSeconds: number | null
    transcript: string
    criteria: Record<string, number>
    band?: number | null
    /** CEFR sub-levels per criterion (reviews since answers are marked one by one). */
    labels?: Record<string, string>
    level: string | null
    comment: string
    corrections: Correction[]
    betterAnswer: string
    upgrades?: { basic: string, better: string, example: string }[]
    pronunciationTips?: string[]
    answers?: { position: number, question: string | null, transcript: string, comment: string, metrics: { words: number, wpm: number, pauses: number, fillers: number } | null }[]
  }[]
}
interface Status { enabled: boolean, speaking?: boolean, allowance: { limit: number | null, used: number, left: number | null, period: 'month' | 'day' | null } | null }

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
  // Recorded in the browser: in storage already (uploaded during the exam), or uploaded now.
  const recordings = await Promise.all((props.recordings ?? []).map(async (r) => {
    const stored = (await r.audioRef) ?? (await uploadFile(new File([r.blob], `speaking-${r.partId}-${r.position + 1}.webm`, { type: r.blob.type || 'audio/webm' }), { purpose: 'recording' })).url
    return { partId: r.partId, position: r.position, audioRef: stored, durationSeconds: r.durationSeconds }
  }))
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
    toast.add({ title: tr('ai.noFeedback'), description: e?.data?.message || tr('test.tryAgain'), color: e?.statusCode === 402 ? 'warning' : 'error' })
    refreshStatus()
  } finally {
    starting.value = false
  }
}

const left = computed(() => status.value?.allowance?.left)
const leftText = computed(() => {
  const a = status.value?.allowance
  if (!a || a.left == null) return ''
  return a.period === 'day' ? tr('ai.leftToday', { left: a.left, limit: a.limit }) : tr('ai.leftMonth', { left: a.left, limit: a.limit })
})
const speaking = computed(() => !!review.value?.parts || props.skill === 'SPEAKING')
// IELTS marks each criterion as a band out of 9, under the IELTS names.
const outOf = computed(() => review.value?.scale ?? 5)
const ielts = computed(() => outOf.value === 9)
const CRITERIA = computed(() => speaking.value
  ? ['fluency', 'vocabulary', 'grammar', 'pronunciation', 'taskAchievement'].map(key => ({ key, label: tr(ielts.value ? `ieltsCriterion.${key}` : `criterion.${key}`) }))
  : ['taskAchievement', 'organisation', 'vocabulary', 'grammar'].map(key => ({ key, label: tr(ielts.value ? `ieltsCriterion.${key}` : `criterion.${key}`) })))
/** Tasks or parts, alike: what each card shows. */
const items = computed(() => review.value?.parts
  ? review.value.parts.map(p => ({
      id: p.partId, label: p.label, band: p.band ?? null, level: p.level, criteria: p.criteria, labels: p.labels, comment: p.comment, corrections: p.corrections, better: p.betterAnswer,
      meta: p.durationSeconds ? `${p.durationSeconds}s` : '', warn: false, transcript: p.transcript,
      answers: p.answers ?? [], upgrades: p.upgrades ?? [], tips: p.pronunciationTips ?? []
    }))
  : (review.value?.tasks ?? []).map(t => ({
      id: t.taskId, label: t.label, band: t.band ?? null, level: t.level, criteria: t.criteria, labels: undefined as Record<string, string> | undefined, comment: t.comment, corrections: t.corrections, better: t.betterSentence,
      meta: tr('ai.wordsOf', { n: t.wordCount, min: t.minWords }), warn: t.wordCount < t.minWords, transcript: null as string | null,
      answers: [] as NonNullable<NonNullable<Review['parts']>[number]['answers']>, upgrades: [] as { basic: string, better: string, example: string }[], tips: [] as string[]
    })))
/** The criteria a card marks: a review from before pronunciation was assessed has four. */
const criteriaOf = (c: Record<string, number>) => CRITERIA.value.filter(x => c[x.key] != null)
const intro = computed(() => speaking.value
  ? tr('ai.introSpeaking')
  : tr('ai.introWriting'))
const levelText = (l: string | null) => (l === 'A2' || l === 'A1' ? tr('common.belowB1') : l ? `CEFR ${l}` : '')
</script>

<template>
  <div
    v-if="speaking ? status?.speaking : status?.enabled"
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
            {{ tr('ai.instant') }}
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
          :label="tr('ai.signIn')"
          icon="i-lucide-log-in"
          class="justify-center"
        />
        <UButton
          v-else-if="left === 0"
          :to="isPremium ? undefined : `/pricing?from=${encodeURIComponent(route.fullPath)}`"
          :disabled="isPremium"
          :label="isPremium ? tr('ai.moreTomorrow') : tr('ai.morePremium')"
          icon="i-lucide-sparkles"
          color="neutral"
          variant="outline"
          class="justify-center"
        />
        <UButton
          v-else
          :label="review?.status === 'FAILED' ? tr('common.tryAgain') : tr('ai.get')"
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
            {{ speaking ? tr('ai.listening') : tr('ai.reading') }}
          </p>
          <p class="text-sm text-muted">
            {{ tr('ai.wait') }}
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
            />{{ tr('ai.feedback') }}
          </p>
          <UBadge
            :label="tr('ai.estimate')"
            color="neutral"
            variant="subtle"
            size="sm"
          />
        </div>
        <div class="rounded-xl bg-gradient-to-br from-[#5870f5] to-[#8b9cff] px-6 py-5 text-white flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p
              v-if="review.band != null"
              class="text-5xl font-bold tabular-nums leading-none whitespace-nowrap"
            >
              <span class="text-xl font-semibold opacity-80 me-2">{{ tr('result.band') }}</span>{{ fmtBand(review.band) }}
            </p>
            <p
              v-else
              class="text-5xl font-bold tabular-nums leading-none whitespace-nowrap"
            >
              {{ review.score }}<span class="text-xl font-semibold opacity-80"> / 75</span>
            </p>
            <p class="mt-2 font-medium">
              {{ levelText(review.cefrLevel) }}
            </p>
          </div>
          <p class="text-xs text-white/80 sm:text-right sm:max-w-44">
            {{ review.band != null ? tr('ai.guideIelts') : tr('ai.guide') }}
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
              {{ tr('ai.keep') }}
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
              {{ tr('ai.workOn') }}
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
              v-if="t.band != null"
              :label="`${tr('result.band')} ${fmtBand(t.band)}`"
              color="primary"
              variant="solid"
              size="sm"
            />
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
              v-for="c in criteriaOf(t.criteria)"
              :key="c.key"
              class="text-sm"
            >
              <div class="flex justify-between mb-1">
                <span class="text-toned">{{ c.label }}</span>
                <span class="font-semibold tabular-nums text-highlighted">
                  <span
                    v-if="t.labels?.[c.key] && t.labels[c.key] !== 'none'"
                    class="text-xs font-medium text-primary me-1.5"
                  >{{ t.labels[c.key] }}</span>{{ t.criteria[c.key] }}/{{ outOf }}</span>
              </div>
              <div class="h-1.5 rounded-full bg-elevated overflow-hidden">
                <div
                  class="h-full rounded-full bg-primary"
                  :style="{ width: `${((t.criteria[c.key] ?? 0) / outOf) * 100}%` }"
                />
              </div>
            </li>
          </ul>
          <p class="text-sm text-toned text-pretty">
            {{ t.comment }}
          </p>
          <!-- Answer by answer: what was heard, how it was spoken, a word on it -->
          <div v-if="t.answers.length">
            <p class="text-xs font-semibold text-muted mb-2">
              {{ tr('ai.byAnswer') }}
            </p>
            <ul class="flex flex-col divide-y divide-default rounded-lg ring ring-default">
              <li
                v-for="a in t.answers"
                :key="a.position"
                class="px-3 py-2.5 text-sm flex flex-col gap-1.5"
              >
                <p
                  v-if="a.question"
                  class="font-medium text-highlighted"
                >
                  {{ a.question }}
                </p>
                <p class="text-toned leading-6 italic">
                  “{{ a.transcript || tr('ai.nothingHeard') }}”
                </p>
                <div
                  v-if="a.metrics?.words"
                  class="flex flex-wrap gap-1.5"
                >
                  <UBadge
                    :label="tr('ai.wpm', { n: a.metrics.wpm })"
                    color="neutral"
                    variant="soft"
                    size="sm"
                  />
                  <UBadge
                    :label="tr('ai.pauses', { n: a.metrics.pauses }, a.metrics.pauses)"
                    color="neutral"
                    variant="soft"
                    size="sm"
                  />
                  <UBadge
                    :label="tr('ai.fillers', { n: a.metrics.fillers }, a.metrics.fillers)"
                    color="neutral"
                    variant="soft"
                    size="sm"
                  />
                </div>
                <p
                  v-if="a.comment"
                  class="text-muted"
                >
                  {{ a.comment }}
                </p>
              </li>
            </ul>
          </div>
          <details
            v-else-if="t.transcript"
            class="rounded-lg ring ring-default px-3 py-2 text-sm"
          >
            <summary class="cursor-pointer text-xs font-semibold text-muted">
              {{ tr('ai.heard') }}
            </summary>
            <p class="mt-2 text-toned leading-6">
              {{ t.transcript }}
            </p>
          </details>
          <div v-if="t.corrections.length">
            <p class="text-xs font-semibold text-muted mb-2">
              {{ tr('ai.corrections') }}
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
          <div v-if="t.upgrades.length">
            <p class="text-xs font-semibold text-muted mb-2">
              {{ tr('ai.upgrades') }}
            </p>
            <ul class="flex flex-col divide-y divide-default rounded-lg ring ring-default">
              <li
                v-for="(u, i) in t.upgrades"
                :key="i"
                class="px-3 py-2.5 text-sm"
              >
                <p>
                  <span class="text-muted">{{ u.basic }}</span>
                  <UIcon
                    name="i-lucide-arrow-right"
                    class="size-3.5 mx-1.5 align-[-2px] text-dimmed"
                  />
                  <span class="font-medium text-primary">{{ u.better }}</span>
                </p>
                <p class="text-xs text-muted mt-0.5 italic">
                  {{ u.example }}
                </p>
              </li>
            </ul>
          </div>
          <div
            v-if="t.tips.length"
            class="rounded-lg bg-warning/10 px-4 py-3"
          >
            <p class="text-xs font-semibold text-warning mb-1.5">
              {{ tr('criterion.pronunciation') }}
            </p>
            <ul class="text-sm text-toned flex flex-col gap-1 list-disc ps-4">
              <li
                v-for="tip in t.tips"
                :key="tip"
              >
                {{ tip }}
              </li>
            </ul>
          </div>
          <div
            v-if="t.better"
            class="rounded-lg bg-elevated px-4 py-3"
          >
            <p class="text-xs font-semibold text-muted mb-1">
              {{ tr('ai.stepUp') }}
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
