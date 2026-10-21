<script setup lang="ts">
import type { Order } from '~/utils/billing'

const { t } = useI18n()

/**
 * Back from Click. Click tells this site about the payment separately (Complete), so the order is
 * asked about until it is paid or cancelled, for up to a couple of minutes.
 */
useSeoMeta({ title: () => t('payment.title'), robots: 'noindex' })
const route = useRoute()
const { refresh: refreshMe } = useMe()
const id = String(route.query.order ?? '')

const order = ref<Order | null>(null)
const failed = ref(false)
const gaveUp = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let tries = 0

async function check() {
  try {
    order.value = await $fetch<Order>(`/api/billing/orders/${id}`)
  } catch {
    failed.value = true
    return
  }
  if (order.value.status === 'PAID') return refreshMe()
  if (order.value.status === 'CANCELLED') return
  if (++tries >= 60) {
    gaveUp.value = true
    return
  }
  timer = setTimeout(check, 2000)
}
onMounted(() => (id ? check() : (failed.value = true)))
onBeforeUnmount(() => clearTimeout(timer))
function again() {
  gaveUp.value = false
  tries = 0
  check()
}
</script>

<template>
  <AppPage
    :title="t('payment.title')"
    icon="i-lucide-credit-card"
  >
    <UCard class="max-w-md w-full mx-auto mt-4 sm:mt-10">
      <div class="flex flex-col items-center text-center gap-3 py-4">
        <template v-if="failed">
          <UIcon
            name="i-lucide-circle-help"
            class="size-10 text-muted"
          />
          <h1 class="text-lg font-semibold text-highlighted">
            {{ t('payment.notFound') }}
          </h1>
          <p class="text-sm text-muted">
            {{ t('payment.notFoundText') }}
          </p>
          <UButton
            to="/profile"
            :label="t('payment.toProfile')"
            color="neutral"
            variant="outline"
          />
        </template>
        <template v-else-if="order?.status === 'PAID'">
          <img
            src="/illustrations/party.svg"
            alt=""
            class="size-16 drop-shadow-lg"
          >
          <h1 class="text-lg font-semibold text-highlighted">
            {{ t('payment.received') }}
          </h1>
          <p class="text-sm text-muted">
            {{ t('payment.receivedText', { plan: order.planName }) }}
          </p>
          <div class="flex flex-wrap justify-center gap-2 pt-1">
            <UButton
              to="/tests"
              :label="t('payment.toTests')"
              icon="i-lucide-clipboard-list"
            />
            <UButton
              to="/profile"
              :label="t('payment.yourPlan')"
              color="neutral"
              variant="outline"
            />
          </div>
        </template>
        <template v-else-if="order?.status === 'CANCELLED'">
          <UIcon
            name="i-lucide-circle-x"
            class="size-10 text-error"
          />
          <h1 class="text-lg font-semibold text-highlighted">
            {{ t('payment.failed') }}
          </h1>
          <p class="text-sm text-muted">
            {{ t('payment.failedText', { n: order.number }) }}
          </p>
          <UButton
            to="/pricing"
            :label="t('payment.backToPlans')"
          />
        </template>
        <template v-else-if="gaveUp">
          <UIcon
            name="i-lucide-hourglass"
            class="size-10 text-warning"
          />
          <h1 class="text-lg font-semibold text-highlighted">
            {{ t('payment.waiting') }}
          </h1>
          <p class="text-sm text-muted">
            {{ t('payment.waitingText') }}
          </p>
          <UButton
            :label="t('payment.checkAgain')"
            icon="i-lucide-refresh-cw"
            @click="again"
          />
        </template>
        <template v-else>
          <UIcon
            name="i-lucide-loader-circle"
            class="size-10 text-primary animate-spin"
          />
          <h1 class="text-lg font-semibold text-highlighted">
            {{ t('payment.confirming') }}
          </h1>
          <p class="text-sm text-muted">
            {{ t('payment.confirmingText') }}
          </p>
        </template>
      </div>
    </UCard>
  </AppPage>
</template>
