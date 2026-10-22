<script setup lang="ts">
/**
 * Onboarding, on a page of its own (layouts/onboarding.vue), the way learning apps run it: one
 * question at a time, large choices, the progress on top and Continue at the bottom. The exam comes
 * first, since the user then only sees that exam's tests and scores; then their level (with what it
 * means, and "not sure"), how long they have learnt, and their goal (an IELTS band, or a Multilevel
 * level and score). The answers are saved before the last step, which asks to send notifications:
 * the browser's, and the Telegram bot's. Anyone signed in without an exam is sent here.
 */
definePageMeta({ layout: 'onboarding' })
const { t } = useI18n()
const route = useRoute()
const { me, refresh } = useMe()
const toast = useToast()
useSeoMeta({ title: () => t('onboarding.title'), robots: 'noindex' })

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
  { value: '<6m', label: t('onboarding.d6m'), icon: 'i-lucide-sprout' },
  { value: '6-12m', label: t('onboarding.d12m'), icon: 'i-lucide-leaf' },
  { value: '1-2y', label: t('onboarding.d2y'), icon: 'i-lucide-book-open-check' },
  { value: '2y+', label: t('onboarding.dMore'), icon: 'i-lucide-graduation-cap' }
])
const BANDS = [5.5, 6, 6.5, 7, 7.5, 8]
const TARGET_LEVELS = [{ value: 'B1', score: 38 }, { value: 'B2', score: 51 }, { value: 'C1', score: 65 }]

const { setExam } = useExam()
const exam = ref<Exam | null>(me.value?.exam ?? null)
const currentLevel = ref<string | null>(me.value?.currentLevel ?? null)
const notSure = ref(false)
const learningDuration = ref<string | null>(me.value?.learningDuration ?? null)
const targetLevel = ref<string | null>(me.value?.targetLevel ?? null)
const targetScore = ref<number | null>(me.value?.targetScore ?? null)
const targetBand = ref<number | null>(me.value?.targetBand ?? null)

type StepKey = 'exam' | 'level' | 'duration' | 'goal' | 'notify'
const STEPS: StepKey[] = ['exam', 'level', 'duration', 'goal', 'notify']
const stepIndex = ref(0)
const step = computed(() => STEPS[stepIndex.value]!)
const progress = computed(() => ((stepIndex.value + 1) / STEPS.length) * 100)
const title = computed(() => ({
  exam: t('onboarding.sExamTitle'),
  level: t('onboarding.s1Title'),
  duration: t('onboarding.s2Title'),
  goal: exam.value === 'IELTS' ? t('onboarding.sBandTitle') : t('onboarding.s3Title'),
  notify: t('onboarding.notifyTitle')
})[step.value])
const lead = computed(() => ({
  exam: t('onboarding.sExamText'),
  level: t('onboarding.s1Text'),
  duration: t('onboarding.s2Text'),
  goal: exam.value === 'IELTS' ? t('onboarding.sBandText') : t('onboarding.goalText'),
  notify: t('onboarding.notifyText')
})[step.value])

const goalChosen = computed(() => (exam.value === 'IELTS' ? targetBand.value != null : !!targetLevel.value || targetScore.value != null))
const canContinue = computed(() => ({
  exam: !!exam.value,
  level: !!currentLevel.value || notSure.value,
  duration: !!learningDuration.value,
  goal: goalChosen.value,
  notify: true
})[step.value])

const saving = ref(false)
/** Saves the answers (before the notifications step), so leaving there loses nothing. */
async function save() {
  saving.value = true
  try {
    await $fetch('/api/me/onboarding', {
      method: 'POST',
      body: {
        exam: exam.value,
        currentLevel: notSure.value ? null : currentLevel.value,
        learningDuration: learningDuration.value,
        targetLevel: exam.value === 'IELTS' ? null : targetLevel.value,
        targetScore: exam.value === 'IELTS' ? null : targetScore.value,
        targetBand: exam.value === 'IELTS' ? targetBand.value : null
      }
    })
    if (exam.value) await setExam(exam.value)
    await refresh()
    return true
  } catch {
    toast.add({ title: t('common.notSaved'), color: 'error' })
    return false
  } finally {
    saving.value = false
  }
}

async function next() {
  if (!canContinue.value || saving.value) return
  if (step.value === 'goal' && !(await save())) return
  if (step.value === 'notify') return finish()
  stepIndex.value += 1
}
function back() {
  if (stepIndex.value > 0 && step.value !== 'notify') stepIndex.value -= 1
}
function finish() {
  const to = typeof route.query.next === 'string' && route.query.next.startsWith('/') && !route.query.next.startsWith('//') ? route.query.next : '/tests'
  return navigateTo(to)
}

// ─── Notifications: the browser's, and the Telegram bot's ───
type PushState = 'unsupported' | 'default' | 'granted' | 'denied'
const push = ref<PushState>('default')
const asking = ref(false)
onMounted(() => {
  push.value = 'Notification' in window ? Notification.permission as PushState : 'unsupported'
})
const fcm = useFcm()
async function allowPush() {
  asking.value = true
  try {
    // Registers this device for messages when push is set up; asks the browser either way.
    await fcm.enable()
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission()
    push.value = 'Notification' in window ? Notification.permission as PushState : 'unsupported'
  } finally {
    asking.value = false
  }
}
const { data: providers } = useFetch<{ telegram: { botId: string } | null }>('/api/auth/providers', { key: 'auth-providers' })
const botOffered = computed(() => !!providers.value?.telegram && !me.value?.telegramBot)
const botOpened = ref(false)
async function openBot() {
  const link = await $fetch<{ url: string }>('/api/telegram/link').catch(() => null)
  if (!link) return toast.add({ title: t('onboarding.botUnavailable'), color: 'warning' })
  window.open(link.url, '_blank', 'noopener')
  botOpened.value = true
}
</script>

<template>
  <div class="flex-1 flex flex-col">
    <!-- Progress -->
    <div class="mx-auto w-full max-w-3xl px-4 sm:px-6 pt-2 flex items-center gap-3">
      <UButton
        v-if="stepIndex > 0 && step !== 'notify'"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        :aria-label="t('common.back')"
        @click="back"
      />
      <UProgress
        :model-value="progress"
        color="primary"
        size="lg"
        class="flex-1"
      />
      <span class="text-sm font-medium text-muted tabular-nums">{{ stepIndex + 1 }}/{{ STEPS.length }}</span>
    </div>

    <div class="mx-auto w-full max-w-3xl px-4 sm:px-6 flex-1 flex flex-col pt-8 sm:pt-12 pb-32">
      <UAlert
        v-if="otherWay && stepIndex === 0"
        color="neutral"
        variant="subtle"
        icon="i-lucide-combine"
        :title="t('onboarding.usedBefore', { way: otherWay === 'google' ? 'Google' : 'Telegram' })"
        :description="t('onboarding.usedBeforeText')"
        :actions="[{ label: t('onboarding.connect', { way: otherWay === 'google' ? 'Google' : 'Telegram' }), color: 'neutral', variant: 'outline', loading: telegram.busy.value, onClick: connectOther }]"
        class="mb-8"
      />

      <Transition
        mode="out-in"
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 translate-y-2"
        leave-active-class="transition duration-150 ease-in"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <section
          :key="step"
          class="flex flex-col gap-8"
        >
          <div class="flex flex-col gap-2 text-center items-center">
            <h1 class="text-2xl sm:text-4xl font-bold text-highlighted text-balance">
              {{ title }}
            </h1>
            <p class="text-muted sm:text-lg max-w-xl text-pretty">
              {{ lead }}
            </p>
          </div>

          <!-- The exam -->
          <div
            v-if="step === 'exam'"
            class="grid sm:grid-cols-2 gap-4"
          >
            <button
              v-for="e in (['IELTS', 'MULTILEVEL'] as const)"
              :key="e"
              type="button"
              :aria-pressed="exam === e"
              class="relative flex flex-col items-start gap-3 rounded-2xl p-6 text-left bg-default ring-2 transition focus-visible:outline-3 focus-visible:outline-primary/40"
              :class="exam === e ? 'ring-primary shadow-lg shadow-primary-500/15' : 'ring-default hover:ring-primary/40'"
              @click="exam = e"
            >
              <UIcon
                v-if="exam === e"
                name="i-lucide-circle-check"
                class="absolute top-4 right-4 size-6 text-primary"
              />
              <div class="size-12 rounded-2xl bg-primary/10 text-primary grid place-items-center">
                <UIcon
                  :name="e === 'IELTS' ? 'i-lucide-globe-2' : 'i-lucide-flag'"
                  class="size-6"
                />
              </div>
              <span class="text-xl font-bold text-highlighted">{{ e === 'IELTS' ? 'IELTS' : 'Multilevel' }}</span>
              <span class="text-sm text-muted">{{ e === 'IELTS' ? t('onboarding.ieltsText') : t('onboarding.multilevelText') }}</span>
            </button>
          </div>

          <!-- Their level, with what each means, or "not sure" -->
          <div
            v-else-if="step === 'level'"
            class="flex flex-col gap-3"
          >
            <button
              v-for="level in LEVELS"
              :key="level"
              type="button"
              :aria-pressed="currentLevel === level && !notSure"
              class="flex items-center gap-4 rounded-2xl p-4 text-left bg-default ring-2 transition focus-visible:outline-3 focus-visible:outline-primary/40"
              :class="currentLevel === level && !notSure ? 'ring-primary' : 'ring-default hover:ring-primary/40'"
              @click="() => { currentLevel = level; notSure = false }"
            >
              <span
                class="size-12 shrink-0 rounded-xl grid place-items-center text-lg font-bold"
                :class="currentLevel === level && !notSure ? 'bg-primary text-inverted' : 'bg-elevated text-highlighted'"
              >{{ level }}</span>
              <span class="text-toned">{{ t(`onboarding.can.${level}`) }}</span>
            </button>
            <button
              type="button"
              :aria-pressed="notSure"
              class="flex items-center gap-4 rounded-2xl p-4 text-left bg-default ring-2 transition"
              :class="notSure ? 'ring-primary' : 'ring-default hover:ring-primary/40'"
              @click="() => { notSure = true; currentLevel = null }"
            >
              <span class="size-12 shrink-0 rounded-xl grid place-items-center bg-elevated text-highlighted">
                <UIcon
                  name="i-lucide-circle-help"
                  class="size-6"
                />
              </span>
              <span class="text-toned">{{ t('onboarding.notSure') }}</span>
            </button>
          </div>

          <!-- How long they have learnt -->
          <div
            v-else-if="step === 'duration'"
            class="grid sm:grid-cols-2 gap-3"
          >
            <button
              v-for="d in DURATIONS"
              :key="d.value"
              type="button"
              :aria-pressed="learningDuration === d.value"
              class="flex items-center gap-4 rounded-2xl p-5 text-left bg-default ring-2 transition focus-visible:outline-3 focus-visible:outline-primary/40"
              :class="learningDuration === d.value ? 'ring-primary' : 'ring-default hover:ring-primary/40'"
              @click="learningDuration = d.value"
            >
              <span
                class="size-11 shrink-0 rounded-xl grid place-items-center"
                :class="learningDuration === d.value ? 'bg-primary text-inverted' : 'bg-elevated text-primary'"
              >
                <UIcon
                  :name="d.icon"
                  class="size-5"
                />
              </span>
              <span class="font-medium text-highlighted">{{ d.label }}</span>
            </button>
          </div>

          <!-- The goal: a band, or a level and a score -->
          <div
            v-else-if="step === 'goal' && exam === 'IELTS'"
            class="grid grid-cols-3 sm:grid-cols-6 gap-3"
          >
            <button
              v-for="band in BANDS"
              :key="band"
              type="button"
              :aria-pressed="targetBand === band"
              class="h-24 rounded-2xl text-2xl font-bold ring-2 transition"
              :class="targetBand === band ? 'bg-primary text-inverted ring-primary' : 'bg-default text-highlighted ring-default hover:ring-primary/40'"
              @click="targetBand = band"
            >
              {{ band.toFixed(1) }}
            </button>
          </div>
          <div
            v-else-if="step === 'goal'"
            class="flex flex-col gap-5"
          >
            <div class="grid grid-cols-3 gap-3">
              <button
                v-for="l in TARGET_LEVELS"
                :key="l.value"
                type="button"
                :aria-pressed="targetLevel === l.value"
                class="flex flex-col items-center justify-center gap-1 h-24 rounded-2xl ring-2 transition"
                :class="targetLevel === l.value ? 'bg-primary text-inverted ring-primary' : 'bg-default text-highlighted ring-default hover:ring-primary/40'"
                @click="targetLevel = targetLevel === l.value ? null : l.value"
              >
                <span class="text-2xl font-bold">{{ l.value }}</span>
                <span class="text-xs opacity-80">{{ l.score }}+ / 75</span>
              </button>
            </div>
            <UFormField
              :label="t('onboarding.orScore')"
              class="max-w-xs mx-auto w-full"
            >
              <UInputNumber
                v-model="targetScore"
                :min="0"
                :max="75"
                placeholder="65"
                class="w-full"
              />
            </UFormField>
          </div>

          <!-- Notifications -->
          <div
            v-else
            class="flex flex-col gap-4 max-w-xl w-full mx-auto"
          >
            <div class="mx-auto size-20 rounded-3xl bg-linear-to-br from-primary-400 to-primary-600 text-white grid place-items-center shadow-lg shadow-primary-500/25">
              <UIcon
                name="i-lucide-bell-ring"
                class="size-10"
              />
            </div>
            <ul class="flex flex-col gap-2 text-sm text-toned">
              <li
                v-for="n in 3"
                :key="n"
                class="flex gap-2"
              >
                <UIcon
                  name="i-lucide-check"
                  class="size-4 mt-0.5 shrink-0 text-success"
                />{{ t(`onboarding.notify${n}`) }}
              </li>
            </ul>
            <div class="flex items-center gap-4 rounded-2xl bg-default ring ring-default p-4">
              <UIcon
                name="i-lucide-monitor-smartphone"
                class="size-6 shrink-0 text-primary"
              />
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-highlighted">
                  {{ t('onboarding.pushTitle') }}
                </p>
                <p class="text-xs text-muted">
                  {{ push === 'granted' ? t('onboarding.pushOn') : push === 'denied' ? t('onboarding.pushDenied') : push === 'unsupported' ? t('onboarding.pushUnsupported') : t('onboarding.pushText') }}
                </p>
              </div>
              <UBadge
                v-if="push === 'granted'"
                :label="t('nav.on')"
                color="success"
                variant="subtle"
              />
              <UButton
                v-else-if="push === 'default'"
                :label="t('onboarding.allow')"
                :loading="asking"
                @click="allowPush"
              />
            </div>
            <div
              v-if="botOffered"
              class="flex items-center gap-4 rounded-2xl bg-default ring ring-default p-4"
            >
              <UIcon
                name="i-simple-icons-telegram"
                class="size-6 shrink-0 text-[#229ED9]"
              />
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-highlighted">
                  {{ t('onboarding.botTitle') }}
                </p>
                <p class="text-xs text-muted">
                  {{ botOpened ? t('onboarding.botOpened') : t('onboarding.botText') }}
                </p>
              </div>
              <UButton
                :label="botOpened ? t('onboarding.botAgain') : t('onboarding.botOpen')"
                color="neutral"
                variant="outline"
                @click="openBot"
              />
            </div>
          </div>
        </section>
      </Transition>
    </div>

    <!-- The way on, always at hand -->
    <div class="fixed inset-x-0 bottom-0 border-t border-default bg-default/90 backdrop-blur">
      <div class="mx-auto w-full max-w-3xl px-4 sm:px-6 py-4 flex items-center gap-3">
        <UButton
          v-if="step === 'notify'"
          :label="t('onboarding.later')"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="finish"
        />
        <UButton
          :label="step === 'notify' ? t('onboarding.startLearning') : t('common.continue')"
          trailing-icon="i-lucide-arrow-right"
          size="xl"
          :loading="saving"
          :disabled="!canContinue"
          class="ms-auto px-10 rounded-full justify-center max-sm:flex-1"
          @click="next"
        />
      </div>
    </div>
  </div>
</template>
