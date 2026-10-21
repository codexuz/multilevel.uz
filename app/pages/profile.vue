<script setup lang="ts">
import type { Order } from '~/utils/billing'

/**
 * Who is signed in, their plan, their goals, and how their marked sections have gone. On a phone,
 * where there is no sidebar, also the account's settings, the staff pages, and logging out.
 */
useSeoMeta({ title: 'Profile', robots: 'noindex' })
const { me, isPremium, credits, rewardCredits, refresh } = useMe()
const toast = useToast()
const { data: purchases } = await useFetch<Order[]>('/api/me/orders', { default: () => [] })

const { data } = await useFetch<{ items: { skill: string, score: number | null, status: string }[], total: number }>('/api/me/attempts', { query: { limit: 100 } })
const best = computed(() => {
  const out: Partial<Record<'LISTENING' | 'READING' | 'WRITING' | 'SPEAKING', number>> = {}
  for (const a of data.value?.items ?? []) if (a.score != null) out[a.skill as keyof typeof out] = Math.max(out[a.skill as keyof typeof out] ?? 0, a.score)
  return out
})
/** The level across the skills taken: from the average of their best scores. */
const overall = computed(() => {
  const scores = Object.values(best.value)
  return scores.length ? cefrOf(scores.reduce((a, b) => a + b, 0) / scores.length) : null
})

/**
 * Linking Telegram or Google, so this account can also sign in with it. If that Telegram or
 * Google already has an account of its own, the user is offered to merge it into this one.
 */
const telegram = useTelegramLogin()
const googleAvailable = computed(() => !!telegram.providers.value?.google)
const route = useRoute()
onMounted(() => {
  if (route.query.google === 'connected') toast.add({ title: 'Google connected', description: 'You can sign in with Google now.', color: 'success' })
  if (route.query.google === 'other') toast.add({ title: 'Google not connected', description: 'This account already has a different Google account.', color: 'warning' })
  if (route.query.google) navigateTo({ query: {} }, { replace: true })
})
async function connectTelegram() {
  if (await telegram.start()) {
    await refresh()
    toast.add({ title: 'Telegram connected', description: 'You can sign in with Telegram now.', color: 'success' })
  }
}

// ─── On a phone: what the sidebar holds on a larger screen ───
const staffNav = useStaffNav()
const colorMode = useColorMode()
const dark = computed({
  get: () => colorMode.value === 'dark',
  set: (on: boolean) => { colorMode.preference = on ? 'dark' : 'light' }
})
const { confirm } = useDialogs()
async function logout() {
  if (!await confirm({ title: 'Log out?', description: 'You can sign in again any time.', confirmLabel: 'Log out', color: 'error' })) return
  await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  reloadNuxtApp({ path: '/' })
}
const accountLinks = [
  { label: 'Earn credits', icon: 'i-lucide-gift', to: '/earn' },
  { label: 'Devices', description: 'Where you are signed in', icon: 'i-lucide-monitor-smartphone', to: '/settings' }
]
</script>

<template>
  <AppPage
    title="Profile"
    icon="i-lucide-user"
  >
    <div class="flex flex-col gap-6 max-w-3xl">
      <div class="flex items-center gap-4">
        <UAvatar
          :src="me?.avatarUrl || undefined"
          :alt="me?.name || 'User'"
          size="xl"
        />
        <div>
          <h1 class="text-2xl font-bold text-highlighted">
            {{ me?.name || 'Your profile' }}
          </h1>
          <p class="text-muted text-sm">
            {{ accountHandle(me) }}
          </p>
        </div>
      </div>

      <!-- Your level, as SmallTalk2Me shows it -->
      <UCard>
        <div class="flex items-center justify-between gap-3 mb-2">
          <div class="flex items-center gap-2">
            <UBadge
              :label="overall ?? '—'"
              color="primary"
              variant="solid"
            />
            <span class="font-semibold text-highlighted">Your level</span>
          </div>
          <span class="text-xs text-muted">Best score in each skill</span>
        </div>
        <div class="grid sm:grid-cols-[1fr_1fr] gap-4 items-center">
          <LevelRadar :scores="best" />
          <ul class="grid grid-cols-2 sm:grid-cols-1 gap-2">
            <li
              v-for="skill in (['LISTENING', 'READING', 'WRITING', 'SPEAKING'] as const)"
              :key="skill"
              class="flex items-center gap-3 rounded-lg bg-elevated px-3 py-2.5"
            >
              <img
                :src="SKILL_ART[skill]"
                alt=""
                class="size-7 shrink-0"
              >
              <div class="min-w-0">
                <p class="text-xs text-muted">
                  {{ SKILL_META[skill].label }}
                </p>
                <p class="font-semibold text-highlighted tabular-nums">
                  {{ best[skill] != null ? `${best[skill]} / 75` : 'Not yet' }}
                </p>
              </div>
            </li>
          </ul>
        </div>
        <UButton
          to="/tests"
          :label="data?.total ? 'Take another test' : 'Take your first test'"
          color="neutral"
          size="lg"
          block
          class="mt-4"
        />
      </UCard>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <h2 class="font-semibold flex items-center gap-2">
              <UIcon
                name="i-lucide-sparkles"
                class="text-primary"
              />Plan
            </h2>
            <UButton
              to="/pricing"
              :label="isPremium ? 'Extend' : 'Get Premium'"
              size="sm"
              :variant="isPremium ? 'outline' : 'solid'"
              :color="isPremium ? 'neutral' : 'primary'"
            />
          </div>
        </template>
        <dl class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt class="text-muted">
              Premium
            </dt><dd class="font-medium">
              {{ isPremium ? (me?.premiumUntil ? `Until ${formatDate(me.premiumUntil)}` : 'On') : 'Free plan' }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Markings left
            </dt><dd class="font-medium tabular-nums">
              {{ credits }}
            </dd>
          </div>
          <div class="col-span-2 flex items-center justify-between gap-3 rounded-lg bg-elevated px-3 py-2.5">
            <div>
              <dt class="text-muted">
                Credits
              </dt><dd class="font-medium tabular-nums">
                {{ rewardCredits }} <span class="text-muted font-normal">· open Premium tests</span>
              </dd>
            </div>
            <UButton
              to="/earn"
              label="Earn more"
              icon="i-lucide-gift"
              size="sm"
              color="neutral"
              variant="outline"
            />
          </div>
        </dl>
        <template
          v-if="purchases?.length"
          #footer
        >
          <p class="text-xs font-medium text-muted mb-2">
            Purchases
          </p>
          <ul class="divide-y divide-default text-sm">
            <li
              v-for="o in purchases"
              :key="o.id"
              class="py-2 flex items-center gap-3"
            >
              <span class="flex-1 min-w-0 truncate">{{ o.planName }}</span>
              <span class="text-muted tabular-nums max-sm:hidden">{{ formatDate(o.paidAt || o.createdAt) }}</span>
              <span class="tabular-nums">{{ fmtUzs(o.amountUzs) }}</span>
              <UBadge
                :label="ORDER_STATUS[o.status].label"
                :color="ORDER_STATUS[o.status].color"
                variant="subtle"
                size="sm"
              />
            </li>
          </ul>
        </template>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold">
            Goals
          </h2>
        </template>
        <dl class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt class="text-muted">
              Current level
            </dt><dd class="font-medium">
              {{ me?.currentLevel || '—' }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Target
            </dt><dd class="font-medium">
              {{ me?.targetLevel || (me?.targetScore != null ? `${me.targetScore} / 75` : '—') }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Learning for
            </dt><dd class="font-medium">
              {{ me?.learningDuration || '—' }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Sections taken
            </dt><dd class="font-medium">
              {{ data?.total ?? 0 }}
            </dd>
          </div>
        </dl>
      </UCard>

      <UCard v-if="me?.email || me?.telegram || telegram.available.value || googleAvailable">
        <template #header>
          <h2 class="font-semibold">
            Sign-in
          </h2>
        </template>
        <ul class="flex flex-col gap-3 text-sm">
          <li
            v-if="me?.email || googleAvailable"
            class="flex items-center gap-3"
          >
            <UIcon
              name="i-logos-google-icon"
              class="size-5 shrink-0"
            />
            <span class="flex-1 min-w-0 truncate">Google<template v-if="me?.email"> · {{ me.email }}</template></span>
            <UButton
              v-if="!me?.email"
              label="Connect"
              size="sm"
              color="neutral"
              variant="outline"
              @click="connectGoogle()"
            />
          </li>
          <li
            v-if="me?.telegram || telegram.available.value"
            class="flex items-center gap-3"
          >
            <UIcon
              name="i-logos-telegram"
              class="size-5 shrink-0"
            />
            <span class="flex-1 min-w-0 truncate">
              Telegram<template v-if="me?.telegram"> · {{ me.telegramUsername ? `@${me.telegramUsername}` : 'connected' }}</template>
            </span>
            <UButton
              v-if="!me?.telegram"
              label="Connect"
              size="sm"
              color="neutral"
              variant="outline"
              :loading="telegram.busy.value"
              @click="connectTelegram"
            />
          </li>
        </ul>
        <p
          v-if="telegram.error.value"
          class="mt-3 text-sm text-error"
        >
          {{ telegram.error.value }}
        </p>
      </UCard>

      <!-- On a phone: settings, staff pages and logging out, which the sidebar holds elsewhere -->
      <div class="lg:hidden flex flex-col gap-4">
        <TelegramNotifySettings />

        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <div class="divide-y divide-default">
            <NuxtLink
              v-for="l in accountLinks"
              :key="l.to"
              :to="l.to"
              class="flex items-center gap-3 px-4 py-3.5 active:bg-elevated"
            >
              <UIcon
                :name="l.icon"
                class="size-5 text-muted shrink-0"
              />
              <span class="flex-1 min-w-0">
                <span class="block font-medium text-highlighted">{{ l.label }}</span>
                <span
                  v-if="l.description"
                  class="block text-xs text-muted"
                >{{ l.description }}</span>
              </span>
              <UBadge
                v-if="l.to === '/earn' && rewardCredits"
                :label="String(rewardCredits)"
                color="primary"
                variant="subtle"
                size="sm"
              />
              <UIcon
                name="i-lucide-chevron-right"
                class="size-4 text-dimmed"
              />
            </NuxtLink>
            <label class="flex items-center gap-3 px-4 py-3.5">
              <UIcon
                :name="dark ? 'i-lucide-moon' : 'i-lucide-sun'"
                class="size-5 text-muted shrink-0"
              />
              <span class="flex-1 font-medium text-highlighted">Dark mode</span>
              <USwitch
                v-model="dark"
                aria-label="Dark mode"
              />
            </label>
          </div>
        </UCard>

        <UCard
          v-if="staffNav.length"
          :ui="{ body: 'p-0 sm:p-0' }"
        >
          <template #header>
            <h2 class="font-semibold">
              Staff
            </h2>
          </template>
          <div class="divide-y divide-default">
            <NuxtLink
              v-for="l in staffNav"
              :key="String(l.to)"
              :to="l.to"
              class="flex items-center gap-3 px-4 py-3.5 active:bg-elevated"
            >
              <UIcon
                :name="String(l.icon)"
                class="size-5 text-muted shrink-0"
              />
              <span class="flex-1 font-medium text-highlighted">{{ l.label }}</span>
              <UIcon
                name="i-lucide-chevron-right"
                class="size-4 text-dimmed"
              />
            </NuxtLink>
          </div>
        </UCard>

        <UButton
          label="Log out"
          icon="i-lucide-log-out"
          color="error"
          variant="soft"
          size="lg"
          block
          @click="logout"
        />
      </div>
    </div>
  </AppPage>
</template>
