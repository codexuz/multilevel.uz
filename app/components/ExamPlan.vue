<script setup lang="ts">
import type { SpotNumbers } from '~/composables/useSpotText'
/**
 * The user's exam plan: the day of their exam and their target, a countdown, where each skill stands,
 * and this week's goals (ticked off by what they do). Without a date, it asks for one.
 */
const { t } = useI18n()
const { spotLabel, spotDetail } = useSpotText()
const goalLabel = (g: Goal) => (g.kind === 'SECTION' ? t('plan.goalSection', { skill: skillLabel(g.skill) }) : t('plan.goalPractise', { skill: skillLabel(g.skill), what: spotLabel(g.kind, g.focus?.key ?? '') }))
const goalDetail = (g: Goal) => (g.kind === 'SECTION'
  ? (g.score == null ? t('plan.noScore') : t('plan.nowAbout', { score: g.score, target: g.target ?? '' }))
  : spotDetail(g.kind, g.skill, g.focus ?? { key: '' }))
interface Goal { key: string, kind: 'SECTION' | 'TYPE' | 'CRITERION', skill: string, label: string, detail: string, done: boolean, to: string, score?: number | null, target?: number, focus?: SpotNumbers }
interface Plan {
  examDate: string | null
  daysLeft: number | null
  targetLevel: string | null
  targetScore: number
  level: Record<string, { score: number | null, source: 'MARKED' | 'AI' | null }>
  week: { from: string, practisedDays: number, aimDays: number }
  goals: Goal[]
}

const toast = useToast()
const { me } = useMe()
const { data: plan } = await useFetch<Plan>('/api/me/plan', { lazy: true, server: false })

const LEVELS = [{ value: 'B1', score: 38 }, { value: 'B2', score: 51 }, { value: 'C1', score: 65 }]
const today = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10)
const editing = ref(false)
const form = reactive({ examDate: '', targetLevel: 'B2' })
const saving = ref(false)

function startEdit() {
  form.examDate = plan.value?.examDate ?? ''
  form.targetLevel = LEVELS.some(l => l.value === plan.value?.targetLevel) ? plan.value!.targetLevel! : 'B2'
  editing.value = true
}
watch(plan, (p) => {
  if (p && !p.examDate && !form.examDate) form.targetLevel = LEVELS.some(l => l.value === p.targetLevel) ? p.targetLevel! : 'B2'
}, { immediate: true })

async function save(examDate: string | null = form.examDate || null) {
  saving.value = true
  try {
    plan.value = await $fetch<Plan>('/api/me/plan', { method: 'PATCH', body: { examDate, targetLevel: form.targetLevel } })
    editing.value = false
    toast.add({ title: examDate ? t('plan.ready') : t('plan.removed'), color: 'success' })
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

const examDay = computed(() => (plan.value?.examDate
  ? new Date(`${plan.value.examDate}T00:00:00`).toLocaleDateString(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long' })
  : ''))
const levelColor = (score: number | null) => {
  const target = plan.value?.targetScore ?? 51
  if (score == null) return 'neutral'
  return score >= target ? 'success' : score >= target - 7 ? 'warning' : 'error'
}
const LEVEL_TEXT: Record<string, string> = { neutral: 'text-dimmed', success: 'text-success', warning: 'text-warning', error: 'text-error' }
const doneCount = computed(() => plan.value?.goals.filter(g => g.done).length ?? 0)
const remindersOff = computed(() => !me.value?.telegram || !me.value?.telegramNotify)
</script>

<template>
  <div v-if="plan">
    <!-- No date yet: ask for it -->
    <UCard
      v-if="!plan.examDate"
      :ui="{ body: 'flex flex-col md:flex-row md:items-end gap-4' }"
    >
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <UIcon
            name="i-lucide-calendar-heart"
            class="size-5 text-primary"
          />
          <h2 class="font-semibold text-highlighted">
            {{ t('plan.when') }}
          </h2>
        </div>
        <p class="text-sm text-muted mt-1">
          {{ t('plan.whenText') }}
        </p>
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <UFormField :label="t('plan.examDay')">
          <UInput
            v-model="form.examDate"
            type="date"
            :min="today"
            :aria-label="t('plan.examDay')"
          />
        </UFormField>
        <UFormField :label="t('plan.target')">
          <UFieldGroup>
            <UButton
              v-for="l in LEVELS"
              :key="l.value"
              :label="l.value"
              :color="form.targetLevel === l.value ? 'primary' : 'neutral'"
              :variant="form.targetLevel === l.value ? 'solid' : 'outline'"
              @click="form.targetLevel = l.value"
            />
          </UFieldGroup>
        </UFormField>
        <UButton
          :label="t('plan.make')"
          icon="i-lucide-sparkles"
          :loading="saving"
          :disabled="!form.examDate"
          @click="save()"
        />
      </div>
    </UCard>

    <!-- The plan -->
    <UCard
      v-else
      :ui="{ body: 'flex flex-col gap-5' }"
    >
      <div class="flex items-start gap-4">
        <div class="rounded-2xl bg-primary/10 text-primary px-4 py-2.5 text-center shrink-0">
          <p class="text-3xl font-bold tabular-nums leading-none">
            {{ plan.daysLeft }}
          </p>
          <p class="text-xs font-medium mt-1">
            {{ t('plan.days', plan.daysLeft ?? 0) }}
          </p>
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="font-semibold text-highlighted">
            {{ plan.daysLeft === 0 ? t('plan.today') : t('plan.toExam') }}
          </h2>
          <p class="text-sm text-muted">
            {{ examDay }} · {{ t('plan.targetWord') }}
            <span class="font-medium text-highlighted">{{ plan.targetLevel && LEVELS.some(l => l.value === plan!.targetLevel) ? `${plan.targetLevel} (${plan.targetScore}+)` : `${plan.targetScore}/75` }}</span>
          </p>
        </div>
        <UButton
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="t('plan.change')"
          @click="startEdit"
        />
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div
          v-for="(l, skill) in plan.level"
          :key="skill"
          class="flex items-center gap-2 rounded-xl bg-elevated/60 px-3 py-2"
        >
          <img
            :src="SKILL_ART[skill]"
            alt=""
            class="size-6 shrink-0"
          >
          <div class="min-w-0">
            <p class="text-xs text-muted">
              {{ skillLabel(skill) }}
            </p>
            <p class="text-sm font-semibold tabular-nums">
              <span :class="LEVEL_TEXT[levelColor(l.score)]">{{ l.score ?? '—' }}</span><span
                v-if="l.score != null"
                class="text-xs text-dimmed font-normal"
              >/75{{ l.source === 'AI' ? ' AI' : '' }}</span>
            </p>
          </div>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm font-semibold text-highlighted">
            {{ t('plan.thisWeek') }}
          </p>
          <p class="text-xs text-muted">
            {{ t('plan.weekLine', { done: plan.week.practisedDays, aim: plan.week.aimDays, goals: doneCount, of: plan.goals.length }) }}
          </p>
        </div>
        <UProgress
          :model-value="Math.min(100, (plan.week.practisedDays / plan.week.aimDays) * 100)"
          size="sm"
          class="mt-2"
        />
        <ul class="mt-3 divide-y divide-default">
          <li
            v-for="g in plan.goals"
            :key="g.key"
            class="flex items-center gap-3 py-2.5"
          >
            <UIcon
              :name="g.done ? 'i-lucide-circle-check' : 'i-lucide-circle'"
              :class="g.done ? 'text-success' : 'text-dimmed'"
              class="size-5 shrink-0"
            />
            <div class="flex-1 min-w-0">
              <p
                class="text-sm font-medium"
                :class="g.done ? 'text-muted line-through' : 'text-highlighted'"
              >
                {{ goalLabel(g) }}
              </p>
              <p class="text-xs text-muted truncate">
                {{ goalDetail(g) }}
              </p>
            </div>
            <UButton
              v-if="!g.done"
              :to="g.to"
              :label="t('common.start')"
              size="xs"
              color="neutral"
              variant="outline"
              trailing-icon="i-lucide-arrow-right"
            />
          </li>
        </ul>
      </div>

      <p
        v-if="remindersOff"
        class="text-xs text-muted flex items-center gap-1.5"
      >
        <UIcon
          name="i-simple-icons-telegram"
          class="size-3.5 shrink-0"
        />
        <span v-if="!me?.telegram">{{ t('plan.telegramToo') }}</span>
        <span v-else>{{ t('plan.remindersOff') }} <ULink
          to="/settings"
          class="text-primary"
        >{{ t('plan.turnOn') }}</ULink></span>
      </p>
    </UCard>

    <UModal
      v-model:open="editing"
      :title="t('plan.yourExam')"
    >
      <template #body>
        <div class="grid gap-4">
          <UFormField :label="t('plan.examDay')">
            <UInput
              v-model="form.examDate"
              type="date"
              :min="today"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('plan.target')">
            <UFieldGroup>
              <UButton
                v-for="l in LEVELS"
                :key="l.value"
                :label="`${l.value} · ${l.score}+`"
                :color="form.targetLevel === l.value ? 'primary' : 'neutral'"
                :variant="form.targetLevel === l.value ? 'solid' : 'outline'"
                @click="form.targetLevel = l.value"
              />
            </UFieldGroup>
          </UFormField>
          <div class="flex justify-between gap-2">
            <UButton
              :label="t('plan.removeDate')"
              color="error"
              variant="ghost"
              :disabled="saving"
              @click="save(null)"
            />
            <UButton
              :label="t('common.save')"
              :loading="saving"
              :disabled="!form.examDate"
              @click="save()"
            />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
