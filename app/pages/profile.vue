<script setup lang="ts">
import type { Order } from '~/utils/billing'

const { t } = useI18n()

/**
 * Who is signed in, their plan, their goals, and how their marked sections have gone. On a phone,
 * where there is no sidebar, also the account's settings, the staff pages, and logging out.
 */
useSeoMeta({ title: () => t('nav.profile'), robots: 'noindex' })
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
  if (route.query.google === 'connected') toast.add({ title: t('profile.googleConnected'), description: t('profile.googleConnectedText'), color: 'success' })
  if (route.query.google === 'other') toast.add({ title: t('profile.googleNot'), description: t('profile.googleNotText'), color: 'warning' })
  if (route.query.google) navigateTo({ query: {} }, { replace: true })
})
async function connectTelegram() {
  if (await telegram.start()) {
    await refresh()
    toast.add({ title: t('bot.connected'), description: t('profile.telegramConnectedText'), color: 'success' })
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
  if (!await confirm({ title: t('profile.logOutSure'), description: t('profile.logOutText'), confirmLabel: t('nav.logOut'), color: 'error' })) return
  await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  reloadNuxtApp({ path: '/' })
}
const accountLinks = computed(() => [
  ...(me.value?.centres?.some(c => c.role !== 'STUDENT') ? [{ label: t('nav.centre'), description: t('profile.centreText'), icon: 'i-lucide-school', to: '/centre' }] : []),
  { label: t('nav.live'), description: t('profile.liveText'), icon: 'i-lucide-trophy', to: '/live' },
  { label: t('nav.earn'), icon: 'i-lucide-gift', to: '/earn' },
  { label: t('nav.promo'), description: t('profile.promoText'), icon: 'i-lucide-ticket', to: '/promo' },
  { label: t('profile.devices'), description: t('profile.devicesText'), icon: 'i-lucide-monitor-smartphone', to: '/settings' }
])
</script>

<template>
  <AppPage
    :title="t('nav.profile')"
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
            <span class="font-semibold text-highlighted">{{ t('profile.yourLevel') }}</span>
          </div>
          <span class="text-xs text-muted">{{ t('profile.bestScore') }}</span>
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
                  {{ skillLabel(skill) }}
                </p>
                <p class="font-semibold text-highlighted tabular-nums">
                  {{ best[skill] != null ? `${best[skill]} / 75` : t('common.notYet') }}
                </p>
              </div>
            </li>
          </ul>
        </div>
        <UButton
          to="/tests"
          :label="data?.total ? t('profile.another') : t('profile.first')"
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
              />{{ t('profile.plan') }}
            </h2>
            <UButton
              to="/pricing"
              :label="isPremium ? t('profile.extend') : t('profile.getPremium')"
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
              {{ isPremium ? (me?.premiumUntil ? t('profile.until', { date: formatDate(me.premiumUntil) }) : t('nav.on')) : t('profile.freePlan') }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              {{ t('profile.markingsLeft') }}
            </dt><dd class="font-medium tabular-nums">
              {{ credits }}
            </dd>
          </div>
          <div class="col-span-2 flex items-center justify-between gap-3 rounded-lg bg-elevated px-3 py-2.5">
            <div>
              <dt class="text-muted">
                {{ t('profile.credits') }}
              </dt><dd class="font-medium tabular-nums">
                {{ rewardCredits }} <span class="text-muted font-normal">· {{ t('profile.openPremium') }}</span>
              </dd>
            </div>
            <UButton
              to="/earn"
              :label="t('profile.earnMore')"
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
            {{ t('profile.purchases') }}
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
                :label="t(`orderStatus.${o.status}`)"
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
            {{ t('profile.goals') }}
          </h2>
        </template>
        <dl class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt class="text-muted">
              {{ t('profile.currentLevel') }}
            </dt><dd class="font-medium">
              {{ me?.currentLevel || '—' }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              {{ t('plan.target') }}
            </dt><dd class="font-medium">
              {{ me?.targetLevel || (me?.targetScore != null ? `${me.targetScore} / 75` : '—') }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              {{ t('profile.learningFor') }}
            </dt><dd class="font-medium">
              {{ me?.learningDuration ? t(`profile.duration.${me.learningDuration}`) : '—' }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              {{ t('profile.sections') }}
            </dt><dd class="font-medium">
              {{ data?.total ?? 0 }}
            </dd>
          </div>
        </dl>
      </UCard>

      <UCard v-if="me?.email || me?.telegram || telegram.available.value || googleAvailable">
        <template #header>
          <h2 class="font-semibold">
            {{ t('profile.signIn') }}
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
              :label="t('profile.connect')"
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
              Telegram<template v-if="me?.telegram"> · {{ me.telegramUsername ? `@${me.telegramUsername}` : t('profile.connected') }}</template>
            </span>
            <UButton
              v-if="!me?.telegram"
              :label="t('profile.connect')"
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

      <ClassCodes />

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
            <div class="flex items-center gap-3 px-4 py-2.5">
              <UIcon
                name="i-lucide-languages"
                class="size-5 text-muted shrink-0"
              />
              <span class="flex-1 font-medium text-highlighted">{{ t('lang.label') }}</span>
              <LanguageSwitcher />
            </div>
            <label class="flex items-center gap-3 px-4 py-3.5">
              <UIcon
                :name="dark ? 'i-lucide-moon' : 'i-lucide-sun'"
                class="size-5 text-muted shrink-0"
              />
              <span class="flex-1 font-medium text-highlighted">{{ t('nav.darkMode') }}</span>
              <USwitch
                v-model="dark"
                :aria-label="t('nav.darkMode')"
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
              {{ t('nav.staff') }}
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
          :label="t('nav.logOut')"
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
