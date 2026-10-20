<script setup lang="ts">
import type { ResultView } from './Review.vue'

/**
 * What a section came to (the result page of the erp-lms IELTS app, for one section): the Multilevel
 * score out of 75 and its CEFR level, right answers, and what happens next. For a guest, how to keep it.
 */
const props = defineProps<{ view: ResultView & { correct?: number | null, total?: number | null, durationSeconds?: number | null, submittedAt?: string | null }, reviewTo: string }>()
const { loggedIn } = useMe()

const skill = computed(() => props.view.skill as keyof typeof SKILL_META)
const meta = computed(() => SKILL_META[skill.value])
const objective = computed(() => skill.value === 'LISTENING' || skill.value === 'READING')
const testTo = computed(() => (props.view.test ? `/tests/${props.view.test.slug}` : '/tests'))
const againTo = computed(() => (props.view.test ? `/tests/${props.view.test.slug}/${skill.value.toLowerCase()}` : '/tests'))
</script>

<template>
  <div class="flex flex-col gap-6 max-w-5xl">
    <div class="flex flex-wrap items-center gap-3">
      <UIcon
        :name="meta.icon"
        class="size-7 text-primary"
      />
      <div class="min-w-0">
        <p class="text-sm text-muted">
          {{ meta.label }}
        </p>
        <h1 class="text-2xl font-semibold text-highlighted truncate">
          {{ view.test?.title }}
        </h1>
      </div>
    </div>

    <div
      v-if="objective"
      class="grid grid-cols-2 lg:grid-cols-4 gap-3"
    >
      <StatTile
        label="Score"
        :value="`${fmtScore(view.score)} / 75`"
        icon="i-lucide-award"
        :color="scoreColor(view.score) === 'neutral' ? 'primary' : scoreColor(view.score)"
      />
      <StatTile
        label="CEFR level"
        :value="view.cefrLevel === 'A2' ? 'Below B1' : (view.cefrLevel ?? '—')"
        icon="i-lucide-graduation-cap"
        color="neutral"
      />
      <StatTile
        label="Correct answers"
        :value="`${view.correct ?? 0} / ${view.total ?? 0}`"
        icon="i-lucide-circle-check"
        color="neutral"
      />
      <StatTile
        label="Time"
        :value="minutesText(view.durationSeconds)"
        icon="i-lucide-timer"
        color="neutral"
      />
    </div>

    <template v-else>
      <div
        v-if="view.status === 'GRADED'"
        class="grid grid-cols-2 gap-3 max-w-xl"
      >
        <StatTile
          label="Score"
          :value="`${fmtScore(view.score)} / 75`"
          icon="i-lucide-award"
          :color="scoreColor(view.score) === 'neutral' ? 'primary' : scoreColor(view.score)"
        />
        <StatTile
          label="CEFR level"
          :value="view.cefrLevel === 'A2' ? 'Below B1' : (view.cefrLevel ?? '—')"
          icon="i-lucide-graduation-cap"
          color="neutral"
        />
      </div>
      <UAlert
        v-else-if="view.saved"
        color="warning"
        variant="subtle"
        icon="i-lucide-hourglass"
        title="With an examiner"
        :description="`Your ${meta.label} is saved and waiting for an examiner. The score and feedback appear here once it is marked.`"
      />
      <UAlert
        v-else
        color="info"
        variant="subtle"
        icon="i-lucide-notebook-pen"
        title="Practice only"
        :description="`${meta.label} is marked by an examiner. Sign in and hand it in again to have it marked; this practice is not saved.`"
      />
    </template>

    <UAlert
      v-if="!view.saved && !loggedIn && objective"
      color="neutral"
      variant="subtle"
      icon="i-lucide-cloud-off"
      title="This result is not saved"
      description="You are not signed in, so this result is shown once and kept nowhere. Sign in to keep your results and see your progress."
      :actions="[{ label: 'Sign in', to: `/login?next=${encodeURIComponent(testTo)}`, color: 'neutral', variant: 'outline' }]"
    />

    <slot />

    <div class="flex flex-wrap gap-2">
      <UButton
        v-if="view.review?.sections?.length"
        :to="reviewTo"
        :label="objective ? 'Review answers' : 'See your answers'"
        icon="i-lucide-list-checks"
      />
      <UButton
        :to="againTo"
        label="Try again"
        icon="i-lucide-rotate-ccw"
        color="neutral"
        variant="outline"
      />
      <UButton
        :to="testTo"
        label="Back to the test"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
      />
      <UButton
        v-if="loggedIn"
        to="/results"
        label="My results"
        icon="i-lucide-chart-column"
        color="neutral"
        variant="ghost"
      />
    </div>
  </div>
</template>
