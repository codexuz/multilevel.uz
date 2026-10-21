<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const { me, refresh } = useMe()
const toast = useToast()

// A brand-new account may be a second one: offer to bring in the account made the other way.
const telegram = useTelegramLogin()
const otherWay = computed<'google' | 'telegram' | null>(() => {
  if (me.value?.email && !me.value.telegram && telegram.available.value) return 'telegram'
  if (me.value?.telegram && !me.value.email && telegram.providers.value?.google) return 'google'
  return null
})
async function connectOther() {
  if (otherWay.value === 'google') return connectGoogle('/onboarding')
  if (await telegram.start()) await refresh()
}

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1']
const DURATIONS = computed(() => [
  { value: '<6m', label: t('onboarding.d6m'), icon: 'i-lucide-seedling' },
  { value: '6-12m', label: t('onboarding.d12m'), icon: 'i-lucide-sprout' },
  { value: '1-2y', label: t('onboarding.d2y'), icon: 'i-lucide-book-open-check' },
  { value: '2y+', label: t('onboarding.dMore'), icon: 'i-lucide-graduation-cap' }
])

const currentLevel = ref<string | null>(me.value?.currentLevel ?? null)
const learningDuration = ref<string | null>(me.value?.learningDuration ?? null)
const targetLevel = ref<string | null>(me.value?.targetLevel ?? null)
const targetScore = ref<number | null>(me.value?.targetScore ?? null)
const step = ref(0)
const saving = ref(false)

const ICONS = ['i-lucide-bar-chart-3', 'i-lucide-clock-3', 'i-lucide-flag', 'i-lucide-target']
const steps = computed(() => ICONS.map((icon, i) => ({
  eyebrow: t('onboarding.step', { n: i + 1, of: ICONS.length }),
  title: t(`onboarding.s${i + 1}Title`),
  description: t(`onboarding.s${i + 1}Text`),
  icon
})))

const active = computed(() => steps.value[step.value]!)
const progress = computed(() => ((step.value + 1) / steps.value.length) * 100)
const canSubmit = computed(() => !!currentLevel.value && !!learningDuration.value
  && (!!targetLevel.value || targetScore.value != null))
const canContinue = computed(() => {
  if (step.value === 0) return !!currentLevel.value
  if (step.value === 1) return !!learningDuration.value
  if (step.value === 2) return true
  return canSubmit.value
})

function selectCurrentLevel(level: string) {
  currentLevel.value = level
}

function selectDuration(duration: string) {
  learningDuration.value = duration
}

function selectTargetLevel(level: string) {
  targetLevel.value = targetLevel.value === level ? null : level
}

function selectTargetScore(score: number) {
  targetScore.value = score
}

function next() {
  if (!canContinue.value) return
  if (step.value < steps.value.length - 1) {
    step.value += 1
    return
  }
  submit()
}

function back() {
  if (step.value > 0) step.value -= 1
}

function skipTargetLevel() {
  targetLevel.value = null
  next()
}

function skipTargetScore() {
  targetScore.value = null
  if (targetLevel.value) submit()
}

async function submit() {
  if (!canSubmit.value || saving.value) return
  saving.value = true
  try {
    await $fetch('/api/me/onboarding', {
      method: 'POST',
      body: {
        currentLevel: currentLevel.value,
        learningDuration: learningDuration.value,
        targetLevel: targetLevel.value,
        targetScore: targetScore.value
      }
    })
    await refresh()
    await navigateTo(typeof route.query.next === 'string' && route.query.next.startsWith('/') && !route.query.next.startsWith('//') ? route.query.next : '/tests')
  } catch {
    toast.add({ title: t('common.notSaved'), color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UContainer class="flex min-h-[calc(100vh-8rem)] max-w-2xl items-center py-8">
    <div class="w-full space-y-6">
      <UAlert
        v-if="otherWay && step === 0"
        color="neutral"
        variant="subtle"
        icon="i-lucide-combine"
        :title="t('onboarding.usedBefore', { way: otherWay === 'google' ? 'Google' : 'Telegram' })"
        :description="t('onboarding.usedBeforeText')"
        :actions="[{ label: t('onboarding.connect', { way: otherWay === 'google' ? 'Google' : 'Telegram' }), color: 'neutral', variant: 'outline', loading: telegram.busy.value, onClick: connectOther }]"
      />
      <div class="space-y-3">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UIcon
                :name="active.icon"
                class="size-6"
              />
            </div>
            <div>
              <p class="text-xs font-medium uppercase text-muted">
                {{ active.eyebrow }}
              </p>
              <h1 class="text-2xl font-bold">
                {{ active.title }}
              </h1>
            </div>
          </div>
          <UBadge
            color="neutral"
            variant="subtle"
            :label="`${step + 1}/${steps.length}`"
          />
        </div>
        <UProgress
          :model-value="progress"
          color="primary"
        />
      </div>

      <section class="min-h-[23rem] rounded-lg border border-default bg-default p-5 shadow-sm sm:p-7">
        <p class="text-muted">
          {{ active.description }}
        </p>

        <div class="mt-6">
          <div
            v-if="step === 0"
            class="grid grid-cols-2 gap-3 sm:grid-cols-5"
          >
            <UButton
              v-for="level in LEVELS"
              :key="level"
              class="h-20 justify-center text-lg font-semibold"
              :color="currentLevel === level ? 'primary' : 'neutral'"
              :variant="currentLevel === level ? 'solid' : 'subtle'"
              :label="level"
              @click="selectCurrentLevel(level)"
            />
          </div>

          <div
            v-else-if="step === 1"
            class="grid gap-3"
          >
            <UButton
              v-for="duration in DURATIONS"
              :key="duration.value"
              class="justify-start p-4"
              :color="learningDuration === duration.value ? 'primary' : 'neutral'"
              :variant="learningDuration === duration.value ? 'solid' : 'subtle'"
              :icon="duration.icon"
              :label="duration.label"
              block
              @click="selectDuration(duration.value)"
            />
          </div>

          <div
            v-else-if="step === 2"
            class="space-y-4"
          >
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <UButton
                v-for="level in LEVELS"
                :key="level"
                class="h-20 justify-center text-lg font-semibold"
                :color="targetLevel === level ? 'primary' : 'neutral'"
                :variant="targetLevel === level ? 'solid' : 'subtle'"
                :label="level"
                @click="selectTargetLevel(level)"
              />
            </div>
            <UButton
              color="neutral"
              variant="ghost"
              :label="t('onboarding.preferScore')"
              trailing-icon="i-lucide-arrow-right"
              @click="skipTargetLevel"
            />
          </div>

          <div
            v-else
            class="space-y-4"
          >
            <UInput
              v-model.number="targetScore"
              type="number"
              :min="0"
              :max="75"
              size="xl"
              placeholder="e.g. 65"
            />
            <div class="grid grid-cols-3 gap-2">
              <UButton
                v-for="score in [55, 65, 70]"
                :key="score"
                color="neutral"
                variant="subtle"
                :label="`${score}`"
                @click="selectTargetScore(score)"
              />
            </div>
            <UButton
              v-if="targetLevel"
              color="neutral"
              variant="ghost"
              :label="t('onboarding.skipScore')"
              @click="skipTargetScore"
            />
          </div>
        </div>
      </section>

      <div class="flex items-center justify-between gap-3">
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-arrow-left"
          :label="t('common.back')"
          :disabled="step === 0 || saving"
          @click="back"
        />
        <UButton
          size="lg"
          :loading="saving"
          :disabled="!canContinue || saving"
          :label="step === steps.length - 1 ? t('onboarding.startLearning') : t('common.continue')"
          trailing-icon="i-lucide-arrow-right"
          @click="next"
        />
      </div>
    </div>
  </UContainer>
</template>
