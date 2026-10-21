<script setup lang="ts">
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
  title: 'Earn free credits',
  description: 'Invite friends to practise for the Multilevel exam and join our Telegram channel to earn credits that open Premium tests.'
})

const { loggedIn, refresh: refreshMe } = useMe()
const toast = useToast()
const route = useRoute()
const { data, refresh } = await useFetch<Rewards>('/api/rewards', { immediate: loggedIn.value, watch: [loggedIn] })

const plural = (n: number, one = 'credit', many = 'credits') => `${n} ${n === 1 ? one : many}`
const rules = computed(() => data.value?.rules ?? { referrer: 2, referred: 1, channel: 1, unlockCost: 1 })
const shareText = computed(() => `Free Multilevel (CEFR) practice tests, checked instantly. Sign up with my link and get ${plural(rules.value.referred, 'free credit', 'free credits')} for a Premium test:`)
const telegramShare = computed(() => data.value ? `https://t.me/share/url?url=${encodeURIComponent(data.value.referral.link)}&text=${encodeURIComponent(shareText.value)}` : '')
const canShare = ref(false)
onMounted(() => (canShare.value = typeof navigator !== 'undefined' && !!navigator.share))

async function copyLink() {
  if (!data.value) return
  try {
    await navigator.clipboard.writeText(data.value.referral.link)
    toast.add({ title: 'Link copied', icon: 'i-lucide-check', color: 'success' })
  } catch {
    toast.add({ title: 'Copy it from the box', description: data.value.referral.link, color: 'neutral' })
  }
}
async function shareLink() {
  if (!data.value) return
  await navigator.share({ title: 'Multilevel practice tests', text: shareText.value, url: data.value.referral.link }).catch(() => {})
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
    toast.add({ title: res.credited ? `+${plural(res.credited)}` : 'Already counted', description: res.credited ? 'Thanks for joining the channel.' : 'You got the channel credits before.', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Not yet', description: e?.data?.message || 'Please try again.', color: 'warning' })
  } finally {
    checking.value = false
  }
}

const REASON: Record<string, string> = {
  REFERRAL: 'A friend you invited finished a test',
  WELCOME: 'Welcome gift for joining by invite',
  TELEGRAM_CHANNEL: 'Joined the Telegram channel',
  UNLOCK: 'Opened',
  GRANT: 'From Multilevel'
}
</script>

<template>
  <AppPage
    title="Earn credits"
    icon="i-lucide-gift"
  >
    <div class="flex flex-col gap-5 max-w-3xl w-full">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-highlighted">
          Earn <span class="text-accent">free credits</span>
        </h1>
        <p class="text-muted mt-1 text-pretty">
          One credit opens one Premium test for good: every section, as often as you like. Invite friends and join our Telegram channel to earn them.
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
              Sign in to get your invite link
            </p>
            <p class="text-sm text-muted text-pretty">
              You earn {{ plural(rules.referrer) }} for each friend who finishes their first test, and they start with {{ plural(rules.referred) }}.
            </p>
          </div>
          <UButton
            :to="`/login?next=${encodeURIComponent(route.fullPath)}`"
            label="Sign in"
            class="justify-center"
          />
        </div>
      </UCard>

      <template v-else-if="data">
        <!-- Balance -->
        <div class="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#5870f5] to-[#8b9cff] px-6 py-6 text-white flex items-center justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-white/85">
              Your credits
            </p>
            <p class="text-5xl font-bold tabular-nums leading-tight">
              {{ data.credits }}
            </p>
            <p class="text-sm text-white/85">
              {{ data.credits >= rules.unlockCost ? `Enough to open ${Math.floor(data.credits / rules.unlockCost)} Premium ${Math.floor(data.credits / rules.unlockCost) === 1 ? 'test' : 'tests'}` : `${plural(rules.unlockCost)} opens a Premium test` }}
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
              label="Find a test"
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
                Invite friends
              </h2>
              <p class="text-sm text-muted text-pretty">
                You get {{ plural(rules.referrer) }} when a friend you invite finishes their first test. They start with {{ plural(rules.referred) }}.
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
              aria-label="Your invite link"
              class="flex-1 min-w-0"
              :ui="{ base: 'font-mono text-xs sm:text-sm' }"
              @focus="($event.target as HTMLInputElement).select()"
            />
            <UButton
              icon="i-lucide-copy"
              label="Copy"
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
              label="Share on Telegram"
              color="neutral"
              variant="soft"
              class="justify-center"
            />
            <UButton
              v-if="canShare"
              icon="i-lucide-share-2"
              label="Share"
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
                Joined
              </dt>
            </div>
            <div class="rounded-lg bg-elevated px-2 py-3">
              <dd class="text-xl font-bold text-highlighted tabular-nums">
                {{ data.referral.rewarded }}
              </dd>
              <dt class="text-xs text-muted">
                Took a test
              </dt>
            </div>
            <div class="rounded-lg bg-elevated px-2 py-3">
              <dd class="text-xl font-bold text-highlighted tabular-nums">
                {{ data.referral.earned }}
              </dd>
              <dt class="text-xs text-muted">
                Credits earned
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
                  Join our Telegram channel
                </h2>
                <p class="text-sm text-muted text-pretty">
                  New tests, exam tips and offers, first. Join and get {{ plural(rules.channel) }}, once.
                </p>
              </div>
            </div>
            <UBadge
              v-if="data.channel.claimed"
              label="Done"
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
              label="1. Join the channel"
              icon="i-lucide-external-link"
              color="neutral"
              variant="soft"
              class="justify-center"
            />
            <UButton
              v-if="data.channel.telegramLinked"
              label="2. I've joined — check"
              icon="i-lucide-badge-check"
              :loading="checking"
              class="justify-center"
              @click="checkChannel"
            />
            <UButton
              v-else-if="telegram.available.value"
              label="2. Connect Telegram to check"
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
              History
            </h2>
          </template>
          <ul class="divide-y divide-default text-sm -my-2">
            <li
              v-for="h in data.history"
              :key="h.id"
              class="py-2.5 flex items-center gap-3"
            >
              <span class="flex-1 min-w-0 truncate text-toned">
                {{ REASON[h.reason] ?? h.reason }}<template v-if="h.test">
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
