<script setup lang="ts">
const { t } = useI18n()
definePageMeta({ guestLayout: true })

/**
 * Earning credits that open premium tests: invite friends with your link (you earn when they
 * finish their first test, they get a welcome credit), and join the Telegram channel. A guest
 * sees how it works and signs in for their link.
 */
interface Rewards {
  credits: number
  rules: { referrer: number, referred: number, channel: number, unlockCost: number }
  referral: { code: string, link: string, invited: number, rewarded: number, earned: number }
  channel: { url: string, telegramLinked: boolean, claimed: boolean } | null
  history: { id: string, delta: number, reason: string, createdAt: string, test: { slug: string, title: string } | null }[]
}

useSeoMeta({
  title: () => t('earn.seoTitle'),
  description: () => t('earn.seoText')
})

const { loggedIn, refresh: refreshMe } = useMe()
const toast = useToast()
const route = useRoute()
const { data, refresh } = await useFetch<Rewards>('/api/rewards', { immediate: loggedIn.value, watch: [loggedIn] })

const plural = (n: number) => t('test.credits', { n }, n)
const rules = computed(() => data.value?.rules ?? { referrer: 2, referred: 1, channel: 1, unlockCost: 1 })
const shareText = computed(() => t('earn.shareText', { credits: plural(rules.value.referred) }))
const telegramShare = computed(() => data.value ? `https://t.me/share/url?url=${encodeURIComponent(data.value.referral.link)}&text=${encodeURIComponent(shareText.value)}` : '')
const canShare = ref(false)
onMounted(() => (canShare.value = typeof navigator !== 'undefined' && !!navigator.share))

async function copyLink() {
  if (!data.value) return
  try {
    await navigator.clipboard.writeText(data.value.referral.link)
    toast.add({ title: t('share.copyLink') + ' ✓', icon: 'i-lucide-check', color: 'success' })
  } catch {
    toast.add({ title: t('share.copyFromBox'), description: data.value.referral.link, color: 'neutral' })
  }
}
async function shareLink() {
  if (!data.value) return
  await navigator.share({ title: t('earn.shareTitle'), text: shareText.value, url: data.value.referral.link }).catch(() => {})
}

// The Telegram channel: link Telegram if needed, join, then let the bot check.
const telegram = useTelegramLogin()
const checking = ref(false)
async function connectTelegram() {
  if (await telegram.start()) await Promise.all([refresh(), refreshMe()])
}
async function checkChannel() {
  checking.value = true
  try {
    const res = await $fetch<{ credited: number, credits: number }>('/api/rewards/telegram-channel', { method: 'POST' })
    await Promise.all([refresh(), refreshMe()])
    toast.add({ title: res.credited ? `+${plural(res.credited)}` : t('earn.already'), description: res.credited ? t('earn.thanks') : t('earn.alreadyText'), color: 'success' })
  } catch (e: any) {
    toast.add({ title: t('common.notYet'), description: e?.data?.message || t('test.tryAgain'), color: 'warning' })
  } finally {
    checking.value = false
  }
}

const reason = (r: string) => t(`earn.reason.${r}`)
</script>

<template>
  <AppPage
    :title="t('nav.earn')"
    icon="i-lucide-gift"
  >
    <div class="flex flex-col gap-5 max-w-3xl w-full">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-highlighted">
          <i18n-t
            keypath="earn.title"
            scope="global"
          >
            <template #accent>
              <span class="text-accent">{{ t('earn.titleAccent') }}</span>
            </template>
          </i18n-t>
        </h1>
        <p class="text-muted mt-1 text-pretty">
          {{ t('earn.intro') }}
        </p>
      </div>

      <!-- Guests: how it works, and the way to a link -->
      <UCard v-if="!loggedIn">
        <div class="flex flex-col sm:flex-row sm:items-center gap-4">
          <img
            src="/illustrations/rocket.svg"
            alt=""
            class="size-16 shrink-0"
          >
          <div class="flex-1">
            <p class="font-semibold text-highlighted">
              {{ t('earn.signInLink') }}
            </p>
            <p class="text-sm text-muted text-pretty">
              {{ t('earn.howGuest', { referrer: plural(rules.referrer), referred: plural(rules.referred) }) }}
            </p>
          </div>
          <UButton
            :to="`/login?next=${encodeURIComponent(route.fullPath)}`"
            :label="t('nav.signIn')"
            class="justify-center"
          />
        </div>
      </UCard>

      <template v-else-if="data">
        <!-- Balance -->
        <div class="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#5870f5] to-[#8b9cff] px-6 py-6 text-white flex items-center justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-white/85">
              {{ t('earn.yourCredits') }}
            </p>
            <p class="text-5xl font-bold tabular-nums leading-tight">
              {{ data.credits }}
            </p>
            <p class="text-sm text-white/85">
              {{ data.credits >= rules.unlockCost ? t('earn.enough', { n: Math.floor(data.credits / rules.unlockCost) }, Math.floor(data.credits / rules.unlockCost)) : t('earn.opensOne', { credits: plural(rules.unlockCost) }) }}
            </p>
          </div>
          <div class="flex flex-col items-end gap-3">
            <img
              src="/illustrations/star.svg"
              alt=""
              class="size-14 drop-shadow-lg"
              aria-hidden="true"
            >
            <UButton
              to="/tests"
              :label="t('earn.findTest')"
              color="neutral"
              variant="solid"
              size="sm"
              class="bg-white text-[#3b4fd8] hover:bg-white/90"
            />
          </div>
        </div>

        <!-- Invite friends -->
        <UCard>
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="font-semibold text-highlighted">
                {{ t('earn.invite') }}
              </h2>
              <p class="text-sm text-muted text-pretty">
                {{ t('earn.howInvite', { referrer: plural(rules.referrer), referred: plural(rules.referred) }) }}
              </p>
            </div>
            <UBadge
              :label="`+${rules.referrer}`"
              color="primary"
              variant="subtle"
              icon="i-lucide-gift"
            />
          </div>

          <div class="mt-4 flex gap-2">
            <UInput
              :model-value="data.referral.link"
              readonly
              :aria-label="t('earn.yourLink')"
              class="flex-1 min-w-0"
              :ui="{ base: 'font-mono text-xs sm:text-sm' }"
              @focus="($event.target as HTMLInputElement).select()"
            />
            <UButton
              icon="i-lucide-copy"
              :label="t('earn.copy')"
              color="neutral"
              variant="outline"
              @click="copyLink"
            />
          </div>
          <div class="mt-2 grid gap-2 sm:flex">
            <UButton
              :to="telegramShare"
              target="_blank"
              external
              icon="i-logos-telegram"
              :label="t('earn.shareTelegram')"
              color="neutral"
              variant="soft"
              class="justify-center"
            />
            <UButton
              v-if="canShare"
              icon="i-lucide-share-2"
              :label="t('earn.share')"
              color="neutral"
              variant="soft"
              class="justify-center"
              @click="shareLink"
            />
          </div>

          <dl class="mt-5 grid grid-cols-3 gap-2 text-center">
            <div class="rounded-lg bg-elevated px-2 py-3">
              <dd class="text-xl font-bold text-highlighted tabular-nums">
                {{ data.referral.invited }}
              </dd>
              <dt class="text-xs text-muted">
                {{ t('earn.joined') }}
              </dt>
            </div>
            <div class="rounded-lg bg-elevated px-2 py-3">
              <dd class="text-xl font-bold text-highlighted tabular-nums">
                {{ data.referral.rewarded }}
              </dd>
              <dt class="text-xs text-muted">
                {{ t('earn.tookTest') }}
              </dt>
            </div>
            <div class="rounded-lg bg-elevated px-2 py-3">
              <dd class="text-xl font-bold text-highlighted tabular-nums">
                {{ data.referral.earned }}
              </dd>
              <dt class="text-xs text-muted">
                {{ t('earn.earned') }}
              </dt>
            </div>
          </dl>
        </UCard>

        <!-- Telegram channel -->
        <UCard v-if="data.channel">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-3">
              <UIcon
                name="i-logos-telegram"
                class="size-9 shrink-0"
              />
              <div>
                <h2 class="font-semibold text-highlighted">
                  {{ t('earn.channel') }}
                </h2>
                <p class="text-sm text-muted text-pretty">
                  {{ t('earn.channelText', { credits: plural(rules.channel) }) }}
                </p>
              </div>
            </div>
            <UBadge
              v-if="data.channel.claimed"
              :label="t('common.done')"
              color="success"
              variant="subtle"
              icon="i-lucide-check"
            />
            <UBadge
              v-else
              :label="`+${rules.channel}`"
              color="primary"
              variant="subtle"
              icon="i-lucide-gift"
            />
          </div>
          <div
            v-if="!data.channel.claimed"
            class="mt-4 grid gap-2 sm:flex"
          >
            <UButton
              :to="data.channel.url"
              target="_blank"
              external
              :label="t('earn.step1')"
              icon="i-lucide-external-link"
              color="neutral"
              variant="soft"
              class="justify-center"
            />
            <UButton
              v-if="data.channel.telegramLinked"
              :label="t('earn.step2')"
              icon="i-lucide-badge-check"
              :loading="checking"
              class="justify-center"
              @click="checkChannel"
            />
            <UButton
              v-else-if="telegram.available.value"
              :label="t('earn.step2Connect')"
              icon="i-logos-telegram"
              color="neutral"
              variant="outline"
              :loading="telegram.busy.value"
              class="justify-center"
              @click="connectTelegram"
            />
          </div>
          <p
            v-if="telegram.error.value"
            class="mt-3 text-sm text-error"
          >
            {{ telegram.error.value }}
          </p>
        </UCard>

        <!-- History -->
        <UCard v-if="data.history.length">
          <template #header>
            <h2 class="font-semibold">
              {{ t('earn.history') }}
            </h2>
          </template>
          <ul class="divide-y divide-default text-sm -my-2">
            <li
              v-for="h in data.history"
              :key="h.id"
              class="py-2.5 flex items-center gap-3"
            >
              <span class="flex-1 min-w-0 truncate text-toned">
                {{ reason(h.reason) }}<template v-if="h.test">
                  <NuxtLink
                    :to="`/tests/${h.test.slug}`"
                    class="text-highlighted hover:underline"
                  >{{ ` ${h.test.title}` }}</NuxtLink>
                </template>
              </span>
              <span class="text-muted tabular-nums max-sm:hidden">{{ formatDate(h.createdAt) }}</span>
              <span
                class="font-semibold tabular-nums w-10 text-right"
                :class="h.delta > 0 ? 'text-success' : 'text-muted'"
              >{{ h.delta > 0 ? `+${h.delta}` : h.delta }}</span>
            </li>
          </ul>
        </UCard>
      </template>
    </div>
  </AppPage>
</template>
