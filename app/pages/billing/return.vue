<script setup lang="ts">
import type { Order } from '~/utils/billing'

/**
 * Back from Click. Click tells this site about the payment separately (Complete), so the order is
 * asked about until it is paid or cancelled, for up to a couple of minutes.
 */
useSeoMeta({ title: 'Payment', robots: 'noindex' })
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
    title="Payment"
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
            We could not find this order
          </h1>
          <p class="text-sm text-muted">
            If you paid, your plan appears on your profile within a minute. Otherwise write to us on Telegram.
          </p>
          <UButton
            to="/profile"
            label="Go to your profile"
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
            Payment received
          </h1>
          <p class="text-sm text-muted">
            {{ order.planName }} is on your account now. Thank you!
          </p>
          <div class="flex flex-wrap justify-center gap-2 pt-1">
            <UButton
              to="/tests"
              label="Go to tests"
              icon="i-lucide-clipboard-list"
            />
            <UButton
              to="/profile"
              label="Your plan"
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
            The payment did not go through
          </h1>
          <p class="text-sm text-muted">
            Nothing was charged for order #{{ order.number }}. You can try again.
          </p>
          <UButton
            to="/pricing"
            label="Back to plans"
          />
        </template>
        <template v-else-if="gaveUp">
          <UIcon
            name="i-lucide-hourglass"
            class="size-10 text-warning"
          />
          <h1 class="text-lg font-semibold text-highlighted">
            Still waiting for Click
          </h1>
          <p class="text-sm text-muted">
            If you finished paying, it can take a little longer to arrive. Your plan switches on by itself when it does.
          </p>
          <UButton
            label="Check again"
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
            Confirming your payment…
          </h1>
          <p class="text-sm text-muted">
            This takes a few seconds. Please keep this page open.
          </p>
        </template>
      </div>
    </UCard>
  </AppPage>
</template>
