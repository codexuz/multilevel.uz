<script setup lang="ts">
import type { Pack, PackPart } from '~/utils/billing'

definePageMeta({ guestLayout: true })

/**
 * One test pack: what is in it (whole tests, single parts, or both), the price, and Buy. Paid through Click when it is set up (a promo
 * code for every plan works here too); otherwise bought on Telegram, where an admin grants it
 * (Users → Grant). Once bought, its tests are the buyer's for good and the page lists them to sit.
 */
const route = useRoute()
const toast = useToast()
const { t } = useI18n()
const { me, loggedIn, refresh: refreshMe } = useMe()
const slug = String(route.params.slug)

const { data: pack, error, refresh } = await useFetch<Pack>(`/api/packs/${slug}`)
if (error.value?.statusCode === 404) throw createError({ statusCode: 404, statusMessage: t('packs.notFound'), fatal: true })
const { data: billing } = await useFetch<{ click: boolean, telegram: string }>('/api/billing/plans')

useSeoMeta({
  title: () => pack.value?.title ?? t('packs.pack'),
  description: () => pack.value?.description || t('packs.seoDescription')
})

const saving = computed(() => (pack.value?.oldPriceUzs && pack.value.oldPriceUzs > pack.value.priceUzs
  ? Math.round((1 - pack.value.priceUzs / pack.value.oldPriceUzs) * 100)
  : 0))
// A price a test only means something when it holds tests alone.
const perTest = computed(() => (pack.value?.testCount && !pack.value.partCount ? Math.round(pack.value.priceUzs / pack.value.testCount / 100) * 100 : null))
const contents = computed(() => (pack.value ? packContents(pack.value, t) : ''))
/** Where a part is sat on its own. */
const partTo = (p: PackPart) => `/tests/${p.test.slug}/${p.skill.toLowerCase()}?part=${p.number}`

// ─── A promo code, typed here or arriving as ?promo=CODE ───
const promoInput = ref(typeof route.query.promo === 'string' ? route.query.promo : '')
const promoOpen = ref(!!promoInput.value)

// ─── Buying ───
const buying = ref(false)
const telegramOpen = ref(false)
async function buy() {
  if (!pack.value) return
  const promo = promoInput.value.trim()
  if (!loggedIn.value) return navigateTo(`/login?next=${encodeURIComponent(`/packs/${slug}?buy=1${promo ? `&promo=${promo}` : ''}`)}`)
  if (!billing.value?.click) {
    telegramOpen.value = true
    return
  }
  buying.value = true
  try {
    const order = await $fetch<{ url?: string, paid?: boolean }>('/api/billing/orders', { method: 'POST', body: { pack: slug, promo: promo || undefined } })
    if (order.paid) {
      await Promise.all([refresh(), refreshMe()])
      toast.add({ title: t('packs.yours'), description: t('packs.yoursText', { title: pack.value.title }), color: 'success' })
      buying.value = false
      return
    }
    window.location.href = order.url!
  } catch (e: any) {
    buying.value = false
    if (e?.data?.data?.code === 'TELEGRAM') telegramOpen.value = true
    else toast.add({ title: t('pricing.paymentFailed'), description: errorMessage(e), color: 'error' })
  }
}
// Back from signing in to buy: carry on.
onMounted(() => {
  if (route.query.buy && loggedIn.value && pack.value && !pack.value.owned) buy()
})

const telegramMessage = computed(() => (pack.value
  ? t('packs.telegramMessage', { pack: pack.value.title, price: fmtUzs(pack.value.priceUzs), account: accountHandle(me.value) || me.value?.id || '' })
  : ''))
const telegramHandle = computed(() => (billing.value?.telegram ?? '').replace(/^https?:\/\/t\.me\//, '@'))
async function copyMessage() {
  try {
    await navigator.clipboard.writeText(telegramMessage.value)
    toast.add({ title: t('pricing.messageCopied'), color: 'success' })
  } catch {}
}

const BENEFITS = computed(() => [1, 2, 3, 4].map(n => t(`packs.benefit${n}`)))
</script>

<template>
  <AppPage
    :title="pack?.title ?? t('packs.pack')"
    icon="i-lucide-package"
  >
    <div
      v-if="pack"
      class="grid lg:grid-cols-[1fr_22rem] gap-6 items-start w-full max-w-5xl mx-auto"
    >
      <div class="flex flex-col gap-5 min-w-0">
        <div>
          <UButton
            to="/tests?view=packs"
            :label="t('packs.title')"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="link"
            class="px-0 mb-2"
          />
          <div class="flex flex-wrap items-center gap-2 mb-2">
            <UBadge
              :label="examLabel(pack.exam)"
              color="primary"
              variant="subtle"
            />
            <UBadge
              :label="contents"
              color="neutral"
              variant="subtle"
            />
          </div>
          <h1 class="text-2xl sm:text-3xl font-bold text-highlighted">
            {{ pack.title }}
          </h1>
          <p
            v-if="pack.description"
            class="text-muted mt-2 whitespace-pre-line"
          >
            {{ pack.description }}
          </p>
        </div>

        <UCard
          v-if="pack.tests.length"
          :ui="{ body: 'p-0 sm:p-0' }"
        >
          <template #header>
            <p class="font-semibold text-highlighted">
              {{ t('packs.inside') }}
            </p>
          </template>
          <ul class="divide-y divide-default">
            <li
              v-for="(test, i) in pack.tests"
              :key="test.id"
              class="flex items-center gap-3 px-4 py-3"
            >
              <span class="size-7 shrink-0 grid place-items-center rounded-full bg-elevated text-xs font-semibold text-toned">{{ i + 1 }}</span>
              <div class="min-w-0 flex-1">
                <p class="font-medium text-highlighted truncate">
                  {{ test.title }}
                </p>
                <p class="text-xs text-muted">
                  {{ examLabel(test.exam, test.module) }}<template v-if="categoryLabel(test.category)">
                    · {{ categoryLabel(test.category) }}
                  </template>
                </p>
              </div>
              <UButton
                :to="`/tests/${test.slug}`"
                :label="pack.owned ? t('packs.sit') : t('packs.preview')"
                :icon="pack.owned ? 'i-lucide-play' : undefined"
                size="sm"
                :color="pack.owned ? 'primary' : 'neutral'"
                :variant="pack.owned ? 'solid' : 'ghost'"
              />
            </li>
          </ul>
        </UCard>

        <UCard
          v-if="pack.parts.length"
          :ui="{ body: 'p-0 sm:p-0' }"
          data-testid="pack-parts"
        >
          <template #header>
            <p class="font-semibold text-highlighted">
              {{ pack.tests.length ? t('packs.partsInside') : t('packs.inside') }}
            </p>
          </template>
          <ul class="divide-y divide-default">
            <li
              v-for="(part, i) in pack.parts"
              :key="part.id"
              class="flex items-center gap-3 px-4 py-3"
            >
              <img
                :src="SKILL_ART[part.skill]"
                alt=""
                class="size-7 shrink-0"
              >
              <div class="min-w-0 flex-1">
                <p class="font-medium text-highlighted truncate">
                  {{ packPartLabel(part) }}
                </p>
                <p class="text-xs text-muted truncate">
                  {{ i + 1 }}. {{ part.test.title }}
                </p>
              </div>
              <UButton
                :to="pack.owned ? partTo(part) : `/tests/${part.test.slug}`"
                :label="pack.owned ? t('packs.practise') : t('packs.preview')"
                :icon="pack.owned ? 'i-lucide-play' : undefined"
                size="sm"
                :color="pack.owned ? 'primary' : 'neutral'"
                :variant="pack.owned ? 'solid' : 'ghost'"
              />
            </li>
          </ul>
        </UCard>
      </div>

      <UCard class="lg:sticky lg:top-6">
        <div class="flex flex-col gap-4">
          <template v-if="pack.owned">
            <div class="flex items-center gap-2 text-success font-semibold">
              <UIcon
                name="i-lucide-badge-check"
                class="size-6"
              />{{ t('packs.yours') }}
            </div>
            <p class="text-sm text-muted">
              {{ t('packs.ownedText') }}
            </p>
            <UButton
              v-if="pack.tests[0] || pack.parts[0]"
              :to="pack.tests[0] ? `/tests/${pack.tests[0].slug}` : partTo(pack.parts[0]!)"
              :label="t('packs.start')"
              icon="i-lucide-play"
              block
              size="lg"
            />
          </template>
          <template v-else>
            <div>
              <div class="flex items-baseline gap-2 flex-wrap">
                <span class="text-3xl font-bold text-highlighted">{{ fmtUzs(pack.priceUzs) }}</span>
                <span
                  v-if="pack.oldPriceUzs"
                  class="text-dimmed line-through"
                >{{ fmtUzs(pack.oldPriceUzs) }}</span>
                <UBadge
                  v-if="saving"
                  :label="`−${saving}%`"
                  color="error"
                  variant="soft"
                />
              </div>
              <p
                v-if="perTest"
                class="text-sm text-muted mt-1"
              >
                {{ t('packs.perTest', { price: fmtUzs(perTest) }) }} · {{ t('packs.oneOff') }}
              </p>
            </div>
            <ul class="flex flex-col gap-2 text-sm">
              <li
                v-for="b in BENEFITS"
                :key="b"
                class="flex gap-2"
              >
                <UIcon
                  name="i-lucide-check"
                  class="size-4 mt-0.5 shrink-0 text-success"
                />{{ b }}
              </li>
            </ul>
            <div>
              <UButton
                v-if="!promoOpen"
                :label="t('pricing.havePromo')"
                color="neutral"
                variant="link"
                size="sm"
                class="px-0"
                @click="promoOpen = true"
              />
              <UInput
                v-else
                v-model="promoInput"
                :placeholder="t('packs.promoPlaceholder')"
                icon="i-lucide-ticket"
                class="w-full"
              />
            </div>
            <UButton
              :label="loggedIn ? t('packs.buy') : t('packs.signInToBuy')"
              icon="i-lucide-shopping-bag"
              :loading="buying"
              block
              size="lg"
              @click="buy"
            />
            <p class="text-xs text-dimmed text-center">
              {{ billing?.click ? t('packs.payClick') : t('packs.payTelegram') }}
            </p>
          </template>
        </div>
      </UCard>
    </div>

    <UModal
      v-model:open="telegramOpen"
      :title="t('packs.buyOnTelegram')"
    >
      <template #body>
        <div class="flex flex-col gap-3">
          <p class="text-sm text-muted">
            {{ t('packs.telegramText', { handle: telegramHandle }) }}
          </p>
          <pre class="whitespace-pre-wrap text-sm rounded-lg bg-elevated p-3">{{ telegramMessage }}</pre>
          <div class="flex flex-wrap gap-2 justify-end">
            <UButton
              :label="t('pricing.copyMessage')"
              icon="i-lucide-copy"
              color="neutral"
              variant="outline"
              @click="copyMessage"
            />
            <UButton
              v-if="billing?.telegram"
              :href="telegramLink(billing.telegram, telegramMessage)"
              target="_blank"
              :label="t('pricing.openTelegram')"
              icon="i-simple-icons-telegram"
            />
          </div>
        </div>
      </template>
    </UModal>
  </AppPage>
</template>
