<script setup lang="ts">
/**
 * Activating a promo code on its own, outside Pricing. A days code switches Premium on at once
 * (signing in first); a code that takes money off a plan is carried to Pricing to choose the plan.
 * /promo?code=CODE fills the field.
 */
definePageMeta({ guestLayout: true })
const { t } = useI18n()
useSeoMeta({ title: () => t('promo.title'), robots: 'noindex' })

const { loggedIn, refresh: refreshMe } = useMe()
const route = useRoute()

interface PromoInfo { code: string, kind: 'PERCENT' | 'AMOUNT' | 'DAYS', value: number }
const code = ref(typeof route.query.code === 'string' ? route.query.code.toUpperCase() : '')
const error = ref('')
const busy = ref(false)
const done = ref<{ promo: PromoInfo, days?: number } | null>(null)

const offer = (p: PromoInfo) => (p.kind === 'PERCENT' ? t('pricing.promoPercent', { n: p.value }) : t('pricing.promoAmount', { sum: fmtUzs(p.value) }))

async function activate() {
  const typed = code.value.trim().toUpperCase()
  if (!typed) {
    error.value = t('promo.empty')
    return
  }
  error.value = ''
  busy.value = true
  try {
    const promo = await $fetch<PromoInfo>('/api/billing/promo', { query: { code: typed } })
    if (promo.kind !== 'DAYS') {
      done.value = { promo }
      return
    }
    if (!loggedIn.value) return navigateTo(`/login?next=${encodeURIComponent(`/promo?code=${promo.code}`)}`)
    const { days } = await $fetch<{ days: number }>('/api/billing/promo/redeem', { method: 'POST', body: { code: promo.code } })
    await refreshMe()
    done.value = { promo, days }
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}

function another() {
  done.value = null
  code.value = ''
}
</script>

<template>
  <AppPage
    :title="t('nav.promo')"
    icon="i-lucide-ticket"
  >
    <div class="w-full max-w-xl mx-auto flex flex-col items-center text-center gap-4 py-4 sm:py-10">
      <div class="size-16 rounded-2xl bg-linear-to-br from-amber-200 to-amber-400 shadow-lg shadow-amber-500/25 rotate-6 flex items-center justify-center">
        <UIcon
          name="i-lucide-gift"
          class="size-8 text-amber-900/80 -rotate-6"
        />
      </div>
      <h1 class="text-4xl sm:text-5xl font-extrabold tracking-tight text-highlighted text-balance">
        {{ t('promo.title') }}
      </h1>
      <p class="text-muted text-balance">
        {{ t('promo.lead') }}
      </p>

      <div class="mt-4 w-full rounded-2xl border border-primary/15 bg-linear-to-br from-primary/3 to-primary/8 p-6 sm:p-8 text-start">
        <!-- Activated -->
        <div
          v-if="done"
          class="flex flex-col items-center text-center gap-3"
        >
          <div class="size-12 rounded-full bg-success/15 flex items-center justify-center">
            <UIcon
              name="i-lucide-check"
              class="size-6 text-success"
            />
          </div>
          <template v-if="done.days != null">
            <p class="text-lg font-semibold text-highlighted">
              {{ t('promo.daysDone') }}
            </p>
            <p class="text-muted">
              {{ t('promo.daysDoneText', { duration: durationText(done.days) }) }}
            </p>
            <UButton
              to="/tests"
              :label="t('promo.openTests')"
              size="xl"
              block
              class="mt-2"
            />
          </template>
          <template v-else>
            <p class="text-lg font-semibold text-highlighted">
              {{ t('promo.discountDone', { code: done.promo.code }) }}
            </p>
            <p class="text-muted">
              {{ t('promo.discountDoneText', { offer: offer(done.promo) }) }}
            </p>
            <UButton
              :to="`/pricing?promo=${encodeURIComponent(done.promo.code)}`"
              :label="t('promo.choosePlan')"
              size="xl"
              block
              class="mt-2"
            />
          </template>
          <UButton
            :label="t('promo.another')"
            color="neutral"
            variant="ghost"
            @click="another"
          />
        </div>

        <!-- The code -->
        <form
          v-else
          class="flex flex-col gap-4"
          @submit.prevent="activate"
        >
          <UFormField
            :label="t('promo.label')"
            :error="error || undefined"
            :ui="{ label: 'font-semibold text-primary' }"
          >
            <UInput
              v-model="code"
              :placeholder="t('promo.placeholder')"
              size="xl"
              autocomplete="off"
              autocapitalize="characters"
              spellcheck="false"
              class="w-full"
              :ui="{ base: 'h-14 text-center text-lg font-semibold uppercase tracking-widest placeholder:font-normal placeholder:text-primary/40' }"
              @update:model-value="error = ''"
            />
          </UFormField>
          <UButton
            type="submit"
            :label="t('promo.submit')"
            :loading="busy"
            size="xl"
            block
            class="h-12 justify-center"
          />
        </form>
      </div>
    </div>
  </AppPage>
</template>
