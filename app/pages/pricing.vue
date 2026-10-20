<script setup lang="ts">
import type { Plan } from '~/utils/billing'

/**
 * Premium and marking credits. Paid through Click when it is set up; otherwise bought privately on
 * Telegram, where an admin switches the plan on (Users → Grant).
 */
const route = useRoute()
const toast = useToast()
const { me, loggedIn, isPremium, credits } = useMe()

const { data } = await useFetch<{ plans: Plan[], click: boolean, telegram: string }>('/api/billing/plans')
const premiumPlans = computed(() => (data.value?.plans ?? []).filter(p => p.durationDays > 0))
const markingPlans = computed(() => (data.value?.plans ?? []).filter(p => p.durationDays === 0))

useSeoMeta({
  title: 'Premium',
  description: 'Multilevel Premium: every practice test, the explanation behind every answer, and Writing and Speaking marked by an examiner.'
})

const FREE = ['Free practice tests', 'Listening and Reading checked instantly', 'Score out of 75 and CEFR level', 'Answer key for every question', 'Writing and Speaking practice to download']
const PREMIUM = ['Every test in the library, new ones every week', 'Why each answer is right, with the line in the passage', 'Writing and Speaking marked by an examiner (with marking credits)', 'All your results kept and compared']

// ─── Buying ───
const buying = ref<string | null>(null)
const telegramPlan = ref<Plan | null>(null)

async function buy(plan: Plan) {
  if (!loggedIn.value) return navigateTo(`/login?next=${encodeURIComponent(`/pricing?plan=${plan.code}`)}`)
  if (!data.value?.click) {
    telegramPlan.value = plan
    return
  }
  buying.value = plan.code
  try {
    const order = await $fetch<{ url: string }>('/api/billing/orders', { method: 'POST', body: { plan: plan.code } })
    window.location.href = order.url
  } catch (e: any) {
    buying.value = null
    if (e?.data?.data?.code === 'TELEGRAM') telegramPlan.value = plan
    else toast.add({ title: 'Payment could not start', description: errorMessage(e), color: 'error' })
  }
}

// Back from signing in to buy a plan: carry on with it.
onMounted(() => {
  const wanted = data.value?.plans.find(p => p.code === route.query.plan)
  if (wanted && loggedIn.value) buy(wanted)
})

const telegramMessage = computed(() => telegramPlan.value
  ? `Hello! I'd like to buy "${telegramPlan.value.name}" (${fmtUzs(telegramPlan.value.priceUzs)}) on multilevel.uz. My account: ${me.value?.email ?? ''}`
  : '')
const telegramHandle = computed(() => (data.value?.telegram ?? '').replace(/^https?:\/\/t\.me\//, '@'))
async function copyMessage() {
  try {
    await navigator.clipboard.writeText(telegramMessage.value)
    toast.add({ title: 'Message copied', color: 'success' })
  } catch {}
}

const perMonth = (p: Plan) => (p.durationDays >= 60 ? Math.round(p.priceUzs / (p.durationDays / 30) / 1000) * 1000 : null)
</script>

<template>
  <AppPage
    title="Premium"
    icon="i-lucide-sparkles"
  >
    <div class="flex flex-col gap-10 max-w-5xl w-full mx-auto">
      <section class="flex flex-col gap-3 text-center items-center pt-2">
        <UBadge
          label="Premium"
          icon="i-lucide-sparkles"
          color="primary"
          variant="subtle"
        />
        <h1 class="text-2xl sm:text-4xl font-semibold tracking-tight text-highlighted text-balance">
          Prepare with every test, and know why every answer is right
        </h1>
        <p class="text-muted max-w-2xl text-pretty">
          Free tests stay free. Premium opens the whole library and the explanations; marking credits get your Writing and Speaking marked by an examiner.
        </p>
        <UAlert
          v-if="loggedIn && (isPremium || credits)"
          icon="i-lucide-badge-check"
          color="success"
          variant="subtle"
          class="max-w-xl text-left mt-2"
          :title="isPremium ? (me?.premiumUntil ? `Premium until ${formatDate(me.premiumUntil)}` : 'Premium is on') : 'Your marking credits'"
          :description="`${creditsText(credits)} left. Buying more adds to what you have.`"
        />
      </section>

      <section class="grid gap-4 sm:grid-cols-3">
        <UCard
          v-for="p in premiumPlans"
          :key="p.id"
          :class="p.featured ? 'ring-2 ring-primary' : ''"
          :ui="{ body: 'flex flex-col gap-4 h-full' }"
        >
          <div class="flex items-center justify-between gap-2">
            <p class="font-semibold text-highlighted">
              {{ durationText(p.durationDays) }}
            </p>
            <UBadge
              v-if="p.featured"
              label="Most popular"
              color="primary"
              variant="solid"
              size="sm"
            />
          </div>
          <div>
            <p class="text-3xl font-semibold tracking-tight text-highlighted tabular-nums">
              {{ fmtUzs(p.priceUzs) }}
            </p>
            <p
              v-if="perMonth(p)"
              class="text-xs text-muted mt-1"
            >
              ≈ {{ fmtUzs(perMonth(p)) }} a month
            </p>
          </div>
          <ul class="flex flex-col gap-2 text-sm">
            <li class="flex gap-2">
              <UIcon
                name="i-lucide-check"
                class="size-4 text-primary shrink-0 mt-0.5"
              />Every test and explanation for {{ durationText(p.durationDays) }}
            </li>
            <li
              v-if="p.credits"
              class="flex gap-2"
            >
              <UIcon
                name="i-lucide-check"
                class="size-4 text-primary shrink-0 mt-0.5"
              />{{ creditsText(p.credits) }} by an examiner
            </li>
            <li class="flex gap-2">
              <UIcon
                name="i-lucide-check"
                class="size-4 text-primary shrink-0 mt-0.5"
              />Pay once — no automatic renewal
            </li>
          </ul>
          <UButton
            :label="`Get ${durationText(p.durationDays)}`"
            :variant="p.featured ? 'solid' : 'outline'"
            :color="p.featured ? 'primary' : 'neutral'"
            :loading="buying === p.code"
            block
            class="mt-auto"
            @click="buy(p)"
          />
        </UCard>
      </section>

      <section
        id="markings"
        class="flex flex-col gap-4 scroll-mt-20"
      >
        <div>
          <h2 class="text-lg font-semibold text-highlighted">
            Writing and Speaking markings
          </h2>
          <p class="text-sm text-muted">
            An examiner gives a score out of 75 and written feedback. One credit marks one section; credits do not expire.
          </p>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <UCard
            v-for="p in markingPlans"
            :key="p.id"
            :ui="{ body: 'flex items-center gap-4' }"
          >
            <div class="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
              <UIcon
                name="i-lucide-pen-line"
                class="size-5"
              />
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-medium text-highlighted">
                {{ p.name }}
              </p>
              <p class="text-sm text-muted tabular-nums">
                {{ fmtUzs(p.priceUzs) }}<span v-if="p.credits > 1"> · {{ fmtUzs(Math.round(p.priceUzs / p.credits)) }} each</span>
              </p>
            </div>
            <UButton
              label="Buy"
              color="neutral"
              variant="outline"
              :loading="buying === p.code"
              @click="buy(p)"
            />
          </UCard>
        </div>
      </section>

      <section class="grid gap-4 md:grid-cols-2">
        <UCard>
          <template #header>
            <p class="font-semibold text-highlighted">
              Free
            </p>
          </template>
          <ul class="flex flex-col gap-2.5 text-sm">
            <li
              v-for="f in FREE"
              :key="f"
              class="flex gap-2"
            >
              <UIcon
                name="i-lucide-check"
                class="size-4 text-muted shrink-0 mt-0.5"
              />{{ f }}
            </li>
          </ul>
        </UCard>
        <UCard>
          <template #header>
            <p class="font-semibold text-highlighted flex items-center gap-2">
              <UIcon
                name="i-lucide-sparkles"
                class="text-primary"
              />Premium adds
            </p>
          </template>
          <ul class="flex flex-col gap-2.5 text-sm">
            <li
              v-for="f in PREMIUM"
              :key="f"
              class="flex gap-2"
            >
              <UIcon
                name="i-lucide-check"
                class="size-4 text-primary shrink-0 mt-0.5"
              />{{ f }}
            </li>
          </ul>
        </UCard>
      </section>

      <section class="flex flex-col gap-3">
        <h2 class="text-lg font-semibold text-highlighted">
          Questions
        </h2>
        <UAccordion
          :items="[
            { label: 'How do I pay?', content: data?.click ? 'With Click: Uzcard or Humo, in the Click app or on its page. Premium starts the moment the payment goes through.' : `Message us on Telegram (${telegramHandle}); we tell you how to pay and switch your plan on for your account.` },
            { label: 'Does it renew automatically?', content: 'No. You pay once for the time you choose. Buying again while Premium runs adds the new time after the current one ends.' },
            { label: 'How long does marking take?', content: 'Usually within 24 hours. You get a notification when your Writing or Speaking is marked.' },
            { label: 'Something went wrong with a payment', content: `Write to us on Telegram (${telegramHandle}) with your account email and we will sort it out.` }
          ]"
          class="rounded-xl bg-default shadow-surface px-4"
        />
      </section>
    </div>

    <UModal
      :open="!!telegramPlan"
      title="Buy on Telegram"
      @update:open="v => !v && (telegramPlan = null)"
    >
      <template #body>
        <div
          v-if="telegramPlan"
          class="flex flex-col gap-4"
        >
          <div class="flex items-center justify-between gap-3 rounded-lg bg-elevated px-4 py-3">
            <div class="min-w-0">
              <p class="font-medium text-highlighted truncate">
                {{ telegramPlan.name }}
              </p>
              <p class="text-sm text-muted">
                {{ [durationText(telegramPlan.durationDays), telegramPlan.credits ? creditsText(telegramPlan.credits) : ''].filter(Boolean).join(' · ') }}
              </p>
            </div>
            <p class="font-semibold tabular-nums text-highlighted shrink-0">
              {{ fmtUzs(telegramPlan.priceUzs) }}
            </p>
          </div>
          <ol class="flex flex-col gap-3 text-sm">
            <li class="flex gap-3">
              <span class="size-6 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-semibold shrink-0">1</span>Send us the message below on Telegram ({{ telegramHandle }}).
            </li>
            <li class="flex gap-3">
              <span class="size-6 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-semibold shrink-0">2</span>Pay the way we suggest (card transfer, Click or Payme).
            </li>
            <li class="flex gap-3">
              <span class="size-6 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-semibold shrink-0">3</span><span>We switch the plan on for <span class="font-medium text-highlighted break-all">{{ me?.email }}</span> — usually within a few hours.</span>
            </li>
          </ol>
          <div class="rounded-lg ring ring-default px-3 py-2.5 text-sm text-toned flex gap-2 items-start">
            <p class="flex-1">
              {{ telegramMessage }}
            </p>
            <UButton
              icon="i-lucide-copy"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="Copy the message"
              @click="copyMessage"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 w-full">
          <UButton
            label="Close"
            color="neutral"
            variant="ghost"
            block
            class="sm:w-auto"
            @click="telegramPlan = null"
          />
          <UButton
            :to="telegramLink(data?.telegram ?? '', telegramMessage)"
            target="_blank"
            label="Open Telegram"
            icon="i-simple-icons-telegram"
            block
            class="sm:w-auto"
          />
        </div>
      </template>
    </UModal>
  </AppPage>
</template>
