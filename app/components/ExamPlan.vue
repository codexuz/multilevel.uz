<script setup lang="ts">
/**
 * The user's exam plan: the day of their exam and their target, a countdown, where each skill stands,
 * and this week's goals (ticked off by what they do). Without a date, it asks for one.
 */
interface Goal { key: string, label: string, detail: string, done: boolean, to: string }
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
    toast.add({ title: examDate ? 'Your plan is ready' : 'Exam date removed', color: 'success' })
  } catch (e) {
    toast.add({ title: 'Not saved', description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

const examDay = computed(() => (plan.value?.examDate
  ? new Date(`${plan.value.examDate}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
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
            When is your exam?
          </h2>
        </div>
        <p class="text-sm text-muted mt-1">
          Set the day and your target for a countdown, a plan for each week and reminders on Telegram.
        </p>
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <UFormField label="Exam day">
          <UInput
            v-model="form.examDate"
            type="date"
            :min="today"
            aria-label="Exam day"
          />
        </UFormField>
        <UFormField label="Target">
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
          label="Make my plan"
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
            {{ plan.daysLeft === 1 ? 'day' : 'days' }}
          </p>
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="font-semibold text-highlighted">
            {{ plan.daysLeft === 0 ? 'Your exam is today. Good luck!' : 'to your exam' }}
          </h2>
          <p class="text-sm text-muted">
            {{ examDay }} · target
            <span class="font-medium text-highlighted">{{ plan.targetLevel && LEVELS.some(l => l.value === plan!.targetLevel) ? `${plan.targetLevel} (${plan.targetScore}+)` : `${plan.targetScore}/75` }}</span>
          </p>
        </div>
        <UButton
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="Change the exam day or target"
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
            This week
          </p>
          <p class="text-xs text-muted">
            {{ plan.week.practisedDays }} of {{ plan.week.aimDays }} practice days · {{ doneCount }}/{{ plan.goals.length }} goals
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
                {{ g.label }}
              </p>
              <p class="text-xs text-muted truncate">
                {{ g.detail }}
              </p>
            </div>
            <UButton
              v-if="!g.done"
              :to="g.to"
              label="Start"
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
        <span v-if="!me?.telegram">Sign in with Telegram too to get reminders before your exam.</span>
        <span v-else>Reminders are off. <ULink
          to="/settings"
          class="text-primary"
        >Turn on Telegram messages</ULink> to get them.</span>
      </p>
    </UCard>

    <UModal
      v-model:open="editing"
      title="Your exam"
    >
      <template #body>
        <div class="grid gap-4">
          <UFormField label="Exam day">
            <UInput
              v-model="form.examDate"
              type="date"
              :min="today"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Target">
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
              label="Remove the date"
              color="error"
              variant="ghost"
              :disabled="saving"
              @click="save(null)"
            />
            <UButton
              label="Save"
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
