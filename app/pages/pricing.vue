<script setup lang="ts">
import type { Plan } from '~/utils/billing'

const { t } = useI18n()

definePageMeta({ guestLayout: true })

/**
 * Premium and marking credits. Paid through Click when it is set up; otherwise bought privately on
 * Telegram, where an admin switches the plan on (Users → Grant).
 */
const route = useRoute()
const toast = useToast()
const { me, loggedIn, isPremium, credits, refresh: refreshMe } = useMe()

const { data } = await useFetch<{ plans: Plan[], click: boolean, telegram: string }>('/api/billing/plans')
const premiumPlans = computed(() => (data.value?.plans ?? []).filter(p => p.durationDays > 0))
const markingPlans = computed(() => (data.value?.plans ?? []).filter(p => p.durationDays === 0))

useSeoMeta({
  title: 'Premium',
  description: () => t('pricing.seo')
})

const FREE = computed(() => [1, 2, 3, 4, 5].map(n => t(`pricing.free${n}`)))
const PREMIUM = computed(() => [1, 2, 3, 4].map(n => t(`pricing.premium${n}`)))
/** What a code gives, in words, from its kind and value. */
const promoWords = (p: { kind: string, value: number }) => (p.kind === 'PERCENT' ? t('pricing.promoPercent', { n: p.value }) : p.kind === 'AMOUNT' ? t('pricing.promoAmount', { sum: fmtUzs(p.value) }) : t('pricing.promoDays', { duration: durationText(p.value) }))

// ─── Promo codes: typed here, or arriving as /pricing?promo=CODE ───
interface PromoInfo { code: string, kind: 'PERCENT' | 'AMOUNT' | 'DAYS', value: number, text: string, prices: Record<string, number> }
const promoInput = ref(typeof route.query.promo === 'string' ? route.query.promo : '')
const promoOpen = ref(!!promoInput.value)
const promo = ref<PromoInfo | null>(null)
const checkingPromo = ref(false)
async function applyPromo() {
  if (!promoInput.value.trim()) return
  checkingPromo.value = true
  try {
    promo.value = await $fetch<PromoInfo>('/api/billing/promo', { query: { code: promoInput.value } })
  } catch (e: any) {
    promo.value = null
    toast.add({ title: t('pricing.promoNot'), description: errorMessage(e), color: 'warning' })
  } finally {
    checkingPromo.value = false
  }
}
function removePromo() {
  promo.value = null
  promoInput.value = ''
}
/** A plan's price with the applied code, and whether the code changes it. */
const priceOf = (p: Plan) => promo.value?.prices[p.code] ?? p.priceUzs
const discounted = (p: Plan) => priceOf(p) < p.priceUzs
const redeeming = ref(false)
async function redeemDays() {
  if (!promo.value) return
  if (!loggedIn.value) return navigateTo(`/login?next=${encodeURIComponent(`/pricing?promo=${promo.value.code}`)}`)
  redeeming.value = true
  try {
    const { days } = await $fetch<{ days: number }>('/api/billing/promo/redeem', { method: 'POST', body: { code: promo.value.code } })
    await refreshMe()
    toast.add({ title: t('pricing.switchedOnPremium'), description: t('pricing.daysAdded', { duration: durationText(days) }), color: 'success' })
    removePromo()
  } catch (e: any) {
    toast.add({ title: t('pricing.notRedeemed'), description: errorMessage(e), color: 'error' })
  } finally {
    redeeming.value = false
  }
}

// ─── Buying ───
const buying = ref<string | null>(null)
const telegramPlan = ref<Plan | null>(null)

async function buy(plan: Plan) {
  const promoQuery = promo.value && discounted(plan) ? `&promo=${promo.value.code}` : ''
  if (!loggedIn.value) return navigateTo(`/login?next=${encodeURIComponent(`/pricing?plan=${plan.code}${promoQuery}`)}`)
  if (!data.value?.click && priceOf(plan) > 0) {
    telegramPlan.value = plan
    return
  }
  buying.value = plan.code
  try {
    const order = await $fetch<{ url?: string, paid?: boolean }>('/api/billing/orders', { method: 'POST', body: { plan: plan.code, promo: promo.value && discounted(plan) ? promo.value.code : undefined } })
    if (order.paid) {
      await refreshMe()
      buying.value = null
      removePromo()
      toast.add({ title: t('pricing.switchedOn'), description: t('pricing.isYours', { plan: plan.name }), color: 'success' })
      return
    }
    window.location.href = order.url!
  } catch (e: any) {
    buying.value = null
    if (e?.data?.data?.code === 'TELEGRAM') telegramPlan.value = plan
    else toast.add({ title: t('pricing.paymentFailed'), description: errorMessage(e), color: 'error' })
  }
}

// A promo link applies its code; back from signing in to buy a plan: carry on with it.
onMounted(async () => {
  if (promoInput.value) await applyPromo()
  const wanted = data.value?.plans.find(p => p.code === route.query.plan)
  if (wanted && loggedIn.value) buy(wanted)
})

const telegramMessage = computed(() => telegramPlan.value
  ? t('pricing.telegramMessage', { plan: telegramPlan.value.name, price: fmtUzs(priceOf(telegramPlan.value)), code: discounted(telegramPlan.value) ? t('pricing.withCode', { code: promo.value!.code }) : '', account: accountHandle(me.value) || me.value?.id || '' })
  : '')
const telegramHandle = computed(() => (data.value?.telegram ?? '').replace(/^https?:\/\/t\.me\//, '@'))
async function copyMessage() {
  try {
    await navigator.clipboard.writeText(telegramMessage.value)
    toast.add({ title: t('pricing.messageCopied'), color: 'success' })
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
        <img
          src="/illustrations/gem.svg"
          alt=""
          class="size-16 drop-shadow-lg"
          aria-hidden="true"
        >
        <h1 class="text-2xl sm:text-4xl font-bold text-highlighted text-balance">
          <i18n-t
            keypath="pricing.title"
            scope="global"
          >
            <template #accent>
              <span class="text-accent">{{ t('pricing.titleAccent') }}</span>
            </template>
          </i18n-t>
        </h1>
        <p class="text-muted max-w-2xl text-pretty">
          {{ t('pricing.intro') }}
        </p>
        <UAlert
          v-if="loggedIn && (isPremium || credits)"
          icon="i-lucide-badge-check"
          color="success"
          variant="subtle"
          class="max-w-xl text-left mt-2"
          :title="isPremium ? (me?.premiumUntil ? t('pricing.premiumUntil', { date: formatDate(me.premiumUntil) }) : t('pricing.premiumOn')) : t('pricing.yourCredits')"
          :description="t('pricing.creditsLeft', { credits: creditsText(credits) })"
        />
      </section>

      <!-- Promo code -->
      <section class="flex flex-col items-center gap-2 -mt-4">
        <UAlert
          v-if="promo"
          color="success"
          variant="subtle"
          icon="i-lucide-ticket-percent"
          class="max-w-xl"
          :title="`${promo.code}: ${promoWords(promo)}`"
          :description="promo.kind === 'DAYS' ? t('pricing.useNow') : t('pricing.applied')"
          :actions="[
            ...(promo.kind === 'DAYS' ? [{ label: t('pricing.getDays', { duration: durationText(promo.value) }), color: 'success' as const, variant: 'solid' as const, loading: redeeming, onClick: redeemDays }] : []),
            { label: t('common.remove'), color: 'neutral' as const, variant: 'ghost' as const, onClick: removePromo }
          ]"
        />
        <UButton
          v-else-if="!promoOpen"
          :label="t('pricing.havePromo')"
          icon="i-lucide-ticket-percent"
          color="neutral"
          variant="link"
          @click="promoOpen = true"
        />
        <form
          v-else
          class="flex gap-2 w-full max-w-sm"
          @submit.prevent="applyPromo"
        >
          <UInput
            v-model="promoInput"
            :placeholder="t('pricing.promoCode')"
            :aria-label="t('pricing.promoCode')"
            class="flex-1"
            :ui="{ base: 'uppercase' }"
            autofocus
          />
          <UButton
            type="submit"
            :label="t('pricing.apply')"
            color="neutral"
            :loading="checkingPromo"
          />
        </form>
      </section>

      <section class="grid gap-4 sm:grid-cols-3">
        <UCard
          v-for="p in premiumPlans"
          :key="p.id"
          :class="p.featured ? 'ring-2 ring-primary' : ''"
          :ui="{ body: 'flex flex-col gap-4 h-full' }"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2.5">
              <img
                :src="p.durationDays >= 90 ? '/illustrations/crown.svg' : p.durationDays >= 30 ? '/illustrations/gem.svg' : '/illustrations/star.svg'"
                alt=""
                class="size-8"
              >
              <p class="font-semibold text-highlighted">
                {{ durationText(p.durationDays) }}
              </p>
            </div>
            <UBadge
              v-if="p.featured"
              :label="t('pricing.popular')"
              color="primary"
              variant="solid"
              size="sm"
            />
          </div>
          <div>
            <p
              v-if="discounted(p)"
              class="text-sm text-muted line-through tabular-nums"
            >
              {{ fmtUzs(p.priceUzs) }}
            </p>
            <p class="text-3xl font-bold text-highlighted tabular-nums">
              {{ fmtUzs(priceOf(p)) }}
            </p>
            <p
              v-if="perMonth(p)"
              class="text-xs text-muted mt-1"
            >
              ≈ {{ t('pricing.perMonth', { sum: fmtUzs(perMonth(p)) }) }}
            </p>
          </div>
          <ul class="flex flex-col gap-2 text-sm">
            <li class="flex gap-2">
              <UIcon
                name="i-lucide-check"
                class="size-4 text-primary shrink-0 mt-0.5"
              />{{ t('pricing.everyTestFor', { duration: durationText(p.durationDays) }) }}
            </li>
            <li
              v-if="p.credits"
              class="flex gap-2"
            >
              <UIcon
                name="i-lucide-check"
                class="size-4 text-primary shrink-0 mt-0.5"
              />{{ t('pricing.byExaminer', { credits: creditsText(p.credits) }) }}
            </li>
            <li class="flex gap-2">
              <UIcon
                name="i-lucide-check"
                class="size-4 text-primary shrink-0 mt-0.5"
              />{{ t('pricing.payOnce') }}
            </li>
          </ul>
          <UButton
            :label="t('pricing.get', { duration: durationText(p.durationDays) })"
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
            {{ t('pricing.markings') }}
          </h2>
          <p class="text-sm text-muted">
            {{ t('pricing.markingsText') }}
          </p>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <UCard
            v-for="p in markingPlans"
            :key="p.id"
            :ui="{ body: 'flex items-center gap-4' }"
          >
            <div class="size-12 rounded-xl bg-elevated grid place-items-center shrink-0">
              <img
                src="/illustrations/writing.svg"
                alt=""
                class="size-7"
              >
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-medium text-highlighted">
                {{ creditsText(p.credits) }}
              </p>
              <p class="text-sm text-muted tabular-nums">
                <span
                  v-if="discounted(p)"
                  class="line-through me-1"
                >{{ fmtUzs(p.priceUzs) }}</span>{{ fmtUzs(priceOf(p)) }}<span v-if="p.credits > 1"> · {{ t('pricing.each', { sum: fmtUzs(Math.round(priceOf(p) / p.credits)) }) }}</span>
              </p>
            </div>
            <UButton
              :label="t('pricing.buy')"
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
              {{ t('common.free') }}
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
              />{{ t('pricing.premiumAdds') }}
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
          {{ t('review.questions') }}
        </h2>
        <UAccordion
          :items="[
            { label: t('pricing.q1'), content: data?.click ? t('pricing.a1Click') : t('pricing.a1Telegram', { handle: telegramHandle }) },
            { label: t('pricing.q2'), content: t('pricing.a2') },
            { label: t('pricing.q3'), content: t('pricing.a3') },
            { label: t('pricing.q4'), content: t('pricing.a4', { handle: telegramHandle }) }
          ]"
          class="rounded-xl ring ring-default px-5"
        />
      </section>
    </div>

    <UModal
      :open="!!telegramPlan"
      :title="t('pricing.buyTelegram')"
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
              {{ fmtUzs(priceOf(telegramPlan)) }}
            </p>
          </div>
          <ol class="flex flex-col gap-3 text-sm">
            <li class="flex gap-3">
              <span class="size-6 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-semibold shrink-0">1</span>{{ t('pricing.step1', { handle: telegramHandle }) }}
            </li>
            <li class="flex gap-3">
              <span class="size-6 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-semibold shrink-0">2</span>{{ t('pricing.step2') }}
            </li>
            <li class="flex gap-3">
              <span class="size-6 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-semibold shrink-0">3</span><span>{{ t('pricing.step3', { account: accountHandle(me) || t('pricing.yourAccount') }) }}</span>
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
              :aria-label="t('pricing.copyMessage')"
              @click="copyMessage"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 w-full">
          <UButton
            :label="t('common.close')"
            color="neutral"
            variant="ghost"
            block
            class="sm:w-auto"
            @click="telegramPlan = null"
          />
          <UButton
            :to="telegramLink(data?.telegram ?? '', telegramMessage)"
            target="_blank"
            :label="t('pricing.openTelegram')"
            icon="i-simple-icons-telegram"
            block
            class="sm:w-auto"
          />
        </div>
      </template>
    </UModal>
  </AppPage>
</template>
