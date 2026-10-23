<script setup lang="ts">
/**
 * A room computer at a mock session. Between candidates it shows the code screen; the candidate
 * types the six-digit code the invigilator gave them at check-in, and sees their sections: each
 * opens when the invigilator opens it for the room, and is sat in the exam interface. When the
 * last is handed in they finish, and the computer is ready for the next code.
 */
definePageMeta({ layout: 'exam' })
const { t } = useI18n()
const toast = useToast()
const { me, refresh: refreshMe } = useMe()
useSeoMeta({ title: () => t('seat.title'), robots: 'noindex' })

interface Seat {
  name: string
  session: { title: string, room: string | null, closesAt: string }
  test: { slug: string, title: string, exam: string }
  sections: { skill: string, open: boolean, done: boolean }[]
  speaking: boolean
  finished: boolean
}
const seat = ref<Seat | null>(null)
const loading = ref(true)
async function load() {
  try {
    seat.value = await $fetch<Seat>('/api/seat/me')
  } catch {
    seat.value = null
  } finally {
    loading.value = false
  }
}
// Sections open while the candidate waits: look again every few seconds.
let timer: ReturnType<typeof setInterval> | undefined
onMounted(async () => {
  if (me.value) await load()
  else loading.value = false
  timer = setInterval(() => seat.value && !seat.value.finished && load(), 5000)
})
onBeforeUnmount(() => clearInterval(timer))

const pin = ref<string[]>([])
const code = computed(() => pin.value.join('').replace(/\D/g, ''))
const taking = ref(false)
async function take() {
  taking.value = true
  try {
    await $fetch('/api/seat', { method: 'POST', body: { code: code.value } })
    await refreshMe()
    await load()
    pin.value = []
  } catch (e: any) {
    toast.add({ title: t('seat.wrongCode'), description: e?.data?.message, color: 'error' })
    pin.value = []
  } finally {
    taking.value = false
  }
}
watch(code, v => v.length === 6 && !taking.value && take())

const leaving = ref(false)
async function leave() {
  leaving.value = true
  try {
    await $fetch('/api/seat/leave', { method: 'POST' })
  } finally {
    seat.value = null
    await refreshMe().catch(() => {})
    leaving.value = false
  }
}

const next = computed(() => seat.value?.sections.find(s => s.open && !s.done) ?? null)
</script>

<template>
  <div class="min-h-dvh bg-muted grid place-items-center p-4">
    <div
      v-if="loading"
      class="text-muted"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-6 animate-spin"
      />
    </div>

    <!-- The code screen, between candidates -->
    <UCard
      v-else-if="!seat"
      class="w-full max-w-md"
      data-testid="seat-code"
    >
      <div class="flex flex-col items-center text-center gap-5 py-4">
        <AppLogo />
        <div>
          <h1 class="text-2xl font-bold text-highlighted">
            {{ t('seat.enterCode') }}
          </h1>
          <p class="text-muted mt-1">
            {{ t('seat.enterCodeText') }}
          </p>
        </div>
        <UPinInput
          v-model="pin"
          :length="6"
          otp
          size="xl"
          :disabled="taking"
          autofocus
          data-testid="seat-pin"
        />
        <UButton
          :label="t('seat.start')"
          size="lg"
          :loading="taking"
          :disabled="code.length !== 6"
          block
          @click="take"
        />
      </div>
    </UCard>

    <!-- The candidate's sections -->
    <UCard
      v-else
      class="w-full max-w-xl"
      data-testid="seat-home"
    >
      <template #header>
        <div class="flex items-center gap-3">
          <AppLogo />
          <div class="ms-auto text-end min-w-0">
            <p class="font-semibold text-highlighted truncate">
              {{ seat.name }}
            </p>
            <p class="text-xs text-muted truncate">
              {{ seat.session.title }}<template v-if="seat.session.room">
                · {{ seat.session.room }}
              </template>
            </p>
          </div>
        </div>
      </template>

      <div class="flex flex-col gap-4">
        <div>
          <p class="text-sm text-muted">
            {{ examLabel(seat.test.exam) }}
          </p>
          <h1 class="text-xl font-bold text-highlighted">
            {{ seat.test.title }}
          </h1>
        </div>

        <ul class="flex flex-col divide-y divide-default rounded-xl ring ring-default">
          <li
            v-for="s in seat.sections"
            :key="s.skill"
            class="flex items-center gap-3 p-4"
            :data-testid="`seat-${s.skill.toLowerCase()}`"
          >
            <img
              :src="SKILL_ART[s.skill]"
              alt=""
              class="size-9"
            >
            <span class="font-semibold text-highlighted flex-1">{{ skillLabel(s.skill) }}</span>
            <UBadge
              v-if="s.done"
              :label="t('seat.handedIn')"
              icon="i-lucide-check"
              color="success"
              variant="subtle"
            />
            <UButton
              v-else-if="s.open"
              :to="`/tests/${seat.test.slug}/${s.skill.toLowerCase()}?seat=1`"
              :label="t('seat.begin')"
              icon="i-lucide-play"
              :color="next?.skill === s.skill ? 'primary' : 'neutral'"
              :variant="next?.skill === s.skill ? 'solid' : 'outline'"
            />
            <span
              v-else
              class="flex items-center gap-1.5 text-sm text-muted"
            >
              <UIcon
                name="i-lucide-lock"
                class="size-4"
              />{{ t('seat.waiting') }}
            </span>
          </li>
          <li
            v-if="seat.speaking"
            class="flex items-center gap-3 p-4"
          >
            <img
              :src="SKILL_ART.SPEAKING"
              alt=""
              class="size-9"
            >
            <span class="font-semibold text-highlighted flex-1">{{ skillLabel('SPEAKING') }}</span>
            <span class="text-sm text-muted">{{ t('seat.faceToFace') }}</span>
          </li>
        </ul>

        <UAlert
          v-if="seat.finished"
          color="success"
          variant="subtle"
          icon="i-lucide-party-popper"
          :title="t('seat.doneTitle')"
          :description="t('seat.doneText')"
        />
        <p
          v-else-if="!next"
          class="text-sm text-muted text-center"
        >
          {{ t('seat.waitText') }}
        </p>

        <UButton
          :label="seat.finished ? t('seat.finish') : t('seat.notMe')"
          :color="seat.finished ? 'primary' : 'neutral'"
          :variant="seat.finished ? 'solid' : 'ghost'"
          :size="seat.finished ? 'lg' : 'sm'"
          :block="seat.finished"
          :loading="leaving"
          data-testid="seat-leave"
          @click="leave"
        />
      </div>
    </UCard>
  </div>
</template>
