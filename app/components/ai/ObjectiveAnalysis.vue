<script setup lang="ts">
/**
 * The AI's analysis of a marked Listening or Reading section: why marks were lost (the patterns
 * behind the mistakes, with the question numbers), a technique for the weakest question types,
 * the paraphrases that were missed, and what to practise next. Asked once, then kept.
 */
const props = defineProps<{ attemptId: string, skill: 'LISTENING' | 'READING' }>()
const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const { loggedIn, isPremium } = useMe()

interface Analysis {
  id: string
  status: 'PENDING' | 'DONE' | 'FAILED'
  error: string | null
  kind?: 'OBJECTIVE'
  perfect?: boolean
  correct?: number
  total?: number
  summary?: string
  patterns?: { type: string, label: string, title: string, detail: string, questions: number[] }[]
  strategies?: { type: string, label: string, tip: string }[]
  paraphrases?: { number: number, question: string, source: string }[]
  timing?: string
  focusType?: string | null
  types?: { type: string, label: string, correct: number, total: number }[]
}
interface Status { enabled: boolean, allowance: { limit: number | null, used: number, left: number | null, period: 'month' | 'day' | null } | null }
const { data: status, refresh: refreshStatus } = useFetch<Status>('/api/ai/status', { key: 'ai-status' })

const analysis = ref<Analysis | null>(null)
const starting = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
async function poll(id: string) {
  clearTimeout(timer)
  try {
    analysis.value = await $fetch<Analysis>(`/api/ai/reviews/${id}`)
  } catch {
    // A dropped connection: keep waiting.
  }
  if (!analysis.value || analysis.value.status === 'PENDING') timer = setTimeout(() => poll(id), 3000)
  else refreshStatus()
}
onBeforeUnmount(() => clearTimeout(timer))
onMounted(async () => {
  if (!loggedIn.value) return
  const existing = await $fetch<Analysis | null>('/api/ai/reviews', { query: { attemptId: props.attemptId } }).catch(() => null)
  if (existing) {
    analysis.value = existing
    if (existing.status === 'PENDING') poll(existing.id)
  }
})
async function start() {
  starting.value = true
  try {
    const { id } = await $fetch<{ id: string }>('/api/ai/objective', { method: 'POST', body: { attemptId: props.attemptId } })
    analysis.value = { id, status: 'PENDING', error: null }
    poll(id)
  } catch (e: any) {
    toast.add({ title: t('ai.noFeedback'), description: e?.data?.message || t('test.tryAgain'), color: e?.statusCode === 402 ? 'warning' : 'error' })
    refreshStatus()
  } finally {
    starting.value = false
  }
}

const left = computed(() => status.value?.allowance?.left)
const leftText = computed(() => {
  const a = status.value?.allowance
  if (!a || a.left == null) return ''
  return a.period === 'day' ? t('ai.leftToday', { left: a.left, limit: a.limit }) : t('ai.leftMonth', { left: a.left, limit: a.limit })
})
const reviewTo = (n?: number) => `/results/${props.attemptId}/review${n ? `?q=${n}` : ''}`
const weakest = computed(() => (analysis.value?.types ?? []).filter(x => x.total).slice(0, 4))
</script>

<template>
  <div
    v-if="status?.enabled"
    class="flex flex-col gap-4"
    data-testid="objective-analysis"
  >
    <!-- Not asked yet -->
    <UCard v-if="!analysis || analysis.status === 'FAILED'">
      <div class="flex flex-col sm:flex-row sm:items-center gap-4">
        <div class="size-12 shrink-0 rounded-xl bg-primary/10 text-primary grid place-items-center">
          <UIcon
            name="i-lucide-scan-search"
            class="size-6"
          />
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-highlighted">
            {{ t('objective.title') }}
          </p>
          <p class="text-sm text-muted text-pretty">
            {{ analysis?.status === 'FAILED' ? analysis.error : t(skill === 'LISTENING' ? 'objective.introListening' : 'objective.introReading') }}
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
          :label="t('ai.signIn')"
          icon="i-lucide-log-in"
          class="justify-center"
        />
        <UButton
          v-else-if="left === 0"
          :to="isPremium ? undefined : `/pricing?from=${encodeURIComponent(route.fullPath)}`"
          :disabled="isPremium"
          :label="isPremium ? t('ai.moreTomorrow') : t('ai.morePremium')"
          icon="i-lucide-sparkles"
          color="neutral"
          variant="outline"
          class="justify-center"
        />
        <UButton
          v-else
          :label="analysis?.status === 'FAILED' ? t('common.tryAgain') : t('objective.get')"
          icon="i-lucide-wand-sparkles"
          :loading="starting"
          class="justify-center"
          data-testid="objective-get"
          @click="start"
        />
      </div>
    </UCard>

    <!-- Being written -->
    <UCard v-else-if="analysis.status === 'PENDING'">
      <div class="flex items-center gap-4">
        <UIcon
          name="i-lucide-loader-circle"
          class="size-8 text-primary animate-spin shrink-0"
        />
        <div>
          <p class="font-semibold text-highlighted">
            {{ t('objective.working') }}
          </p>
          <p class="text-sm text-muted">
            {{ t('ai.wait') }}
          </p>
        </div>
      </div>
    </UCard>

    <!-- The analysis -->
    <UCard
      v-else
      :ui="{ body: 'flex flex-col gap-5' }"
    >
      <div class="flex items-center justify-between gap-3">
        <p class="font-semibold text-highlighted flex items-center gap-2">
          <UIcon
            name="i-lucide-scan-search"
            class="text-primary"
          />{{ t('objective.title') }}
        </p>
        <UBadge
          v-if="analysis.total"
          :label="`${analysis.correct}/${analysis.total}`"
          color="neutral"
          variant="subtle"
          class="tabular-nums"
        />
      </div>

      <p
        v-if="analysis.perfect"
        class="text-toned"
      >
        {{ t('objective.perfect') }}
      </p>
      <p
        v-else-if="analysis.summary"
        class="text-toned leading-7"
      >
        {{ analysis.summary }}
      </p>

      <!-- By question type: where the marks went -->
      <div
        v-if="weakest.length"
        class="grid sm:grid-cols-2 gap-2"
      >
        <div
          v-for="x in weakest"
          :key="x.type"
          class="flex items-center gap-3 text-sm"
        >
          <span class="flex-1 min-w-0 truncate">{{ questionTypeLabel(x.type) }}</span>
          <UProgress
            :model-value="Math.round((x.correct / x.total) * 100)"
            :color="x.correct / x.total >= 0.7 ? 'success' : x.correct / x.total >= 0.5 ? 'warning' : 'error'"
            size="sm"
            class="w-24"
          />
          <span class="tabular-nums text-muted w-10 text-end">{{ x.correct }}/{{ x.total }}</span>
        </div>
      </div>

      <div
        v-if="analysis.patterns?.length"
        class="flex flex-col gap-3"
      >
        <p class="text-sm font-semibold text-highlighted">
          {{ t('objective.patterns') }}
        </p>
        <div
          v-for="(p, i) in analysis.patterns"
          :key="i"
          class="rounded-lg ring ring-default p-3 flex flex-col gap-1.5"
          data-testid="objective-pattern"
        >
          <div class="flex flex-wrap items-center gap-2">
            <UBadge
              :label="questionTypeLabel(p.type)"
              color="neutral"
              variant="soft"
              size="sm"
            />
            <span class="font-medium text-highlighted">{{ p.title }}</span>
          </div>
          <p class="text-sm text-toned leading-6">
            {{ p.detail }}
          </p>
          <div
            v-if="p.questions.length"
            class="flex flex-wrap gap-1"
          >
            <UButton
              v-for="n in p.questions"
              :key="n"
              :to="reviewTo(n)"
              :label="`Q${n}`"
              size="xs"
              color="neutral"
              variant="outline"
            />
          </div>
        </div>
      </div>

      <div v-if="analysis.strategies?.length">
        <p class="text-sm font-semibold text-highlighted mb-2">
          {{ t('objective.strategies') }}
        </p>
        <ul class="flex flex-col gap-2">
          <li
            v-for="(s, i) in analysis.strategies"
            :key="i"
            class="flex gap-2 text-sm leading-6"
          >
            <UIcon
              name="i-lucide-lightbulb"
              class="size-4 text-warning shrink-0 mt-1"
            />
            <span><span class="font-medium text-highlighted">{{ questionTypeLabel(s.type) }}:</span> {{ s.tip }}</span>
          </li>
        </ul>
      </div>

      <div v-if="analysis.paraphrases?.length">
        <p class="text-sm font-semibold text-highlighted mb-1">
          {{ t('objective.paraphrases') }}
        </p>
        <p class="text-xs text-muted mb-2">
          {{ t(skill === 'LISTENING' ? 'objective.paraphrasesHelpListening' : 'objective.paraphrasesHelp') }}
        </p>
        <div class="flex flex-col divide-y divide-default rounded-lg ring ring-default">
          <div
            v-for="(p, i) in analysis.paraphrases"
            :key="i"
            class="grid grid-cols-[2.5rem_1fr_auto_1fr] items-center gap-2 px-3 py-2 text-sm"
          >
            <span class="text-xs text-muted tabular-nums">Q{{ p.number }}</span>
            <span class="text-toned">{{ p.question }}</span>
            <UIcon
              name="i-lucide-equal"
              class="size-4 text-dimmed"
            />
            <span class="font-medium text-highlighted">{{ p.source }}</span>
          </div>
        </div>
      </div>

      <UAlert
        v-if="analysis.timing"
        icon="i-lucide-timer"
        color="neutral"
        variant="subtle"
        :description="analysis.timing"
      />

      <div class="flex flex-wrap gap-2">
        <UButton
          :to="reviewTo()"
          :label="t('objective.seeWhy')"
          icon="i-lucide-list-checks"
          color="neutral"
          variant="outline"
        />
        <UButton
          v-if="analysis.focusType"
          to="/results#insights"
          :label="t('objective.practise', { type: questionTypeLabel(analysis.focusType) })"
          icon="i-lucide-target"
        />
      </div>
      <p class="text-xs text-dimmed">
        {{ t('objective.guide') }}
      </p>
    </UCard>
  </div>
</template>
