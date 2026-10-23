<script setup lang="ts">
import type { ResultView } from './Review.vue'

const { t } = useI18n()

/**
 * What a section came to, in the manner of SmallTalk2Me's result: the score on a blue card with
 * what the CEFR level means, how each part went, and what to do next. For a guest, how to keep it.
 */
const props = defineProps<{ view: ResultView & { correct?: number | null, total?: number | null, durationSeconds?: number | null, submittedAt?: string | null }, reviewTo: string }>()
const { loggedIn, me } = useMe()
// A centre's student: their own teachers mark Writing and Speaking.
const byTeacher = computed(() => !!me.value?.teacherMarks)

const skill = computed(() => props.view.skill as keyof typeof SKILL_META)
const objective = computed(() => skill.value === 'LISTENING' || skill.value === 'READING')
const ielts = computed(() => props.view.exam === 'IELTS')
const scored = computed(() => hasResult(props.view) && (objective.value || props.view.status === 'GRADED'))
const level = computed(() => props.view.cefrLevel ?? (ielts.value ? bandCefr(props.view.band) : cefrOf(props.view.score)))
// An IELTS part practised on its own has no band: its right answers are the result.
const partOnly = computed(() => ielts.value && objective.value && props.view.band == null && props.view.total != null)
const testTo = computed(() => (props.view.test ? `/tests/${props.view.test.slug}` : '/tests'))
const againTo = computed(() => (props.view.test ? `/tests/${props.view.test.slug}/${skill.value.toLowerCase()}${props.view.partNumber ? `?part=${props.view.partNumber}` : ''}` : '/tests'))

const levelText = (l: string) => (ielts.value ? t(`result.ieltsLevel.${l}`) : t(`result.level.${l}`))

/** How each part went: what to keep doing and what to work on. */
const partsWent = computed(() => (props.view.review?.sections?.[0]?.parts ?? []).map((p: any) => {
  const items = p.groups.flatMap((g: any) => g.items)
  const right = items.filter((i: any) => i.isCorrect).length
  return { label: `${t('part.part', { n: p.partNumber })}${p.title ? ` — ${p.title}` : ''}`, right, total: items.length, share: items.length ? right / items.length : 0 }
}).filter((p: any) => p.total))
</script>

<template>
  <div class="flex flex-col gap-6 max-w-3xl w-full">
    <div class="flex items-center gap-4">
      <div class="size-14 shrink-0 rounded-2xl bg-elevated grid place-items-center">
        <img
          :src="SKILL_ART[skill]"
          alt=""
          class="size-9"
        >
      </div>
      <div class="min-w-0">
        <p class="text-sm font-medium text-primary">
          <template v-if="ielts">
            IELTS ·
          </template>{{ skillLabel(view.skill) }}<span v-if="view.partNumber"> · {{ partName(view.skill, view.partNumber, view.exam) }}</span>
        </p>
        <h1 class="text-xl sm:text-2xl font-bold text-highlighted text-balance">
          {{ view.test?.title }}
        </h1>
      </div>
    </div>

    <!-- The score -->
    <UCard v-if="scored || partOnly">
      <p class="text-center font-semibold text-highlighted mb-3">
        {{ partOnly ? t('result.correct') : ielts ? t('result.yourBand') : t('home.yourScore') }}
      </p>
      <div class="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#5870f5] to-[#8b9cff] px-6 py-7 text-center text-white">
        <p
          v-if="partOnly"
          class="text-6xl font-bold tabular-nums leading-none"
        >
          {{ view.correct ?? 0 }}<span class="text-2xl font-semibold opacity-80"> / {{ view.total }}</span>
        </p>
        <p
          v-else-if="ielts"
          class="text-6xl font-bold tabular-nums leading-none"
        >
          <span class="text-2xl font-semibold opacity-80 me-2">{{ t('result.band') }}</span>{{ fmtBand(view.band) }}
        </p>
        <p
          v-else
          class="text-6xl font-bold tabular-nums leading-none"
        >
          {{ fmtScore(view.score) }}<span class="text-2xl font-semibold opacity-80"> / 75</span>
        </p>
        <p
          v-if="partOnly"
          class="mt-2 font-medium"
        >
          {{ t('result.partOnlyIelts') }}
        </p>
        <p
          v-else
          class="mt-2 font-medium"
        >
          {{ level === 'A2' ? t('common.belowB1') : `CEFR ${level}` }}
        </p>
        <img
          src="/illustrations/star.svg"
          alt=""
          class="absolute -left-3 -bottom-3 size-16 opacity-90"
          aria-hidden="true"
        >
      </div>
      <p
        v-if="level && !partOnly"
        class="mt-4 text-sm text-toned text-pretty"
      >
        {{ levelText(level) }}
      </p>
      <div
        v-if="objective && !partOnly"
        class="mt-4 grid grid-cols-2 gap-3"
      >
        <div class="rounded-lg bg-elevated px-4 py-3">
          <p class="text-xs text-muted">
            {{ t('result.correct') }}
          </p>
          <p class="text-lg font-semibold text-highlighted tabular-nums">
            {{ view.correct ?? 0 }} / {{ view.total ?? 0 }}
          </p>
        </div>
        <div class="rounded-lg bg-elevated px-4 py-3">
          <p class="text-xs text-muted">
            {{ t('result.time') }}
          </p>
          <p class="text-lg font-semibold text-highlighted">
            {{ minutesText(view.durationSeconds) }}
          </p>
        </div>
      </div>
    </UCard>

    <!-- Writing and Speaking not marked (yet) -->
    <UCard v-else>
      <div class="flex items-center gap-4">
        <img
          :src="view.saved ? '/illustrations/hourglass.svg' : '/illustrations/memo.svg'"
          alt=""
          class="size-14 shrink-0"
        >
        <div>
          <p class="font-semibold text-highlighted">
            {{ view.saved ? t(byTeacher ? 'result.withTeacher' : 'result.withExaminer') : t('result.practiceOnly') }}
          </p>
          <p class="text-sm text-muted text-pretty">
            {{ view.saved
              ? t(byTeacher ? 'result.waitingTeacherText' : 'result.waitingText', { skill: skillLabel(view.skill) })
              : t('result.practiceText', { skill: skillLabel(view.skill) }) }}
          </p>
        </div>
      </div>
    </UCard>

    <!-- How each part went -->
    <UCard v-if="partsWent.length">
      <p class="font-semibold text-highlighted mb-3">
        {{ t('result.partsWent') }}
      </p>
      <ul class="flex flex-col gap-2.5">
        <li
          v-for="p in partsWent"
          :key="p.label"
          class="flex items-start gap-3 text-sm"
        >
          <UIcon
            :name="p.share >= 0.7 ? 'i-lucide-circle-check' : p.share >= 0.4 ? 'i-lucide-circle-dot' : 'i-lucide-circle-alert'"
            class="size-5 shrink-0"
            :class="p.share >= 0.7 ? 'text-success' : p.share >= 0.4 ? 'text-warning' : 'text-error'"
          />
          <span class="flex-1 min-w-0 text-toned">{{ p.label }}</span>
          <span class="font-semibold tabular-nums text-highlighted">{{ p.right }}/{{ p.total }}</span>
        </li>
      </ul>
    </UCard>

    <UAlert
      v-if="!view.saved && !loggedIn && objective"
      color="neutral"
      variant="subtle"
      icon="i-lucide-cloud-off"
      :title="t('result.notSaved')"
      :description="t('result.notSavedText')"
      :actions="[{ label: t('nav.signIn'), to: `/login?next=${encodeURIComponent(testTo)}`, color: 'neutral', variant: 'outline' }]"
    />

    <BillingPaywall
      v-if="view.review?.sections?.[0]?.locked"
      reason="explanations"
      :count="view.review.sections[0].locked"
      compact
    />

    <slot />

    <div class="grid gap-2 sm:flex sm:flex-wrap">
      <UButton
        v-if="view.review?.sections?.length"
        :to="reviewTo"
        :label="objective ? t('result.reviewAnswers') : t('result.seeAnswers')"
        icon="i-lucide-list-checks"
        size="lg"
        class="justify-center"
      />
      <ResultShare
        v-if="view.saved && view.id && scored && loggedIn"
        :attempt-id="view.id"
      />
      <UButton
        :to="againTo"
        :label="t('common.tryAgain')"
        icon="i-lucide-rotate-ccw"
        color="neutral"
        size="lg"
        class="justify-center"
      />
      <UButton
        :to="testTo"
        :label="t('sit.backToTest')"
        color="neutral"
        variant="ghost"
        size="lg"
        class="justify-center"
      />
      <UButton
        v-if="loggedIn"
        to="/results"
        :label="t('nav.results')"
        color="neutral"
        variant="ghost"
        size="lg"
        class="justify-center"
      />
    </div>
  </div>
</template>
