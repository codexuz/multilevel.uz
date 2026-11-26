<script setup lang="ts">
/**
 * The phone's "More" (student app): a bottom sheet with the pages the tab bar has no room for, my
 * account, the language and theme, and signing out. Closes when a page is opened.
 */
const open = defineModel<boolean>('open', { default: false })
const { me, rewardCredits } = useMe()
const { live } = useLiveMock()
const { t } = useI18n()
const { locale, languages, choose } = useLanguage()
const colorMode = useColorMode()
const route = useRoute()

const hasGroup = computed(() => (me.value?.classes?.length ?? 0) > 0)
/** The pages in the sheet (the tab bar has Dashboard, Tests, Courses and Results). */
interface MoreLink { label: string, icon: string, to: string, badge?: string }
const links = computed<MoreLink[]>(() => [
  { label: t('nav.groups'), icon: 'i-lucide-users', to: '/groups' },
  { label: t('nav.words'), icon: 'i-lucide-book-open-text', to: '/words' },
  ...(hasGroup.value ? [{ label: t('nav.online'), icon: 'i-lucide-video', to: '/online' }] : []),
  { label: t('nav.live'), icon: 'i-lucide-trophy', to: '/live', badge: live.value ? t('nav.liveBadge') : undefined },
  { label: t('nav.earn'), icon: 'i-lucide-gift', to: '/earn', badge: rewardCredits.value ? String(rewardCredits.value) : undefined },
  { label: t('nav.profile'), icon: 'i-lucide-user', to: '/profile' },
  { label: t('nav.settings'), icon: 'i-lucide-settings', to: '/settings' },
  { label: t('nav.support'), icon: 'i-lucide-life-buoy', to: '/support' }
])
const isHere = (to: string) => route.path === to || route.path.startsWith(`${to}/`)
watch(() => route.fullPath, () => (open.value = false))

const displayName = computed(() => me.value?.name || accountHandle(me.value) || t('nav.account'))
const dark = computed(() => colorMode.value === 'dark')
async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  reloadNuxtApp({ path: '/' })
}
</script>

<template>
  <UDrawer
    v-model:open="open"
    :title="t('nav.more')"
    :ui="{ content: 'lg:hidden', header: 'sr-only', body: 'flex flex-col gap-4 pb-safe' }"
  >
    <template #body>
      <NuxtLink
        to="/profile"
        class="flex items-center gap-3 rounded-lg p-2 -m-2 hover:bg-elevated/60"
      >
        <UAvatar
          :src="me?.avatarUrl ?? undefined"
          :alt="displayName"
          size="lg"
        />
        <div class="min-w-0 flex-1">
          <p class="font-extrabold text-highlighted truncate">
            {{ displayName }}
          </p>
          <p class="text-sm text-muted truncate">
            {{ accountHandle(me) }}
          </p>
        </div>
        <UIcon
          name="i-lucide-chevron-right"
          class="size-5 text-dimmed"
        />
      </NuxtLink>

      <nav
        class="grid grid-cols-3 gap-2"
        :aria-label="t('nav.more')"
        data-testid="more-links"
      >
        <NuxtLink
          v-for="l in links"
          :key="l.to"
          :to="l.to"
          class="tile relative flex flex-col items-center justify-center gap-1.5 py-3 px-1 text-center"
          :data-state="isHere(l.to) ? 'selected' : undefined"
        >
          <UIcon
            :name="l.icon"
            class="size-6 text-primary"
          />
          <span class="text-xs font-bold text-highlighted leading-tight">{{ l.label }}</span>
          <UBadge
            v-if="l.badge"
            :label="l.badge"
            color="error"
            size="sm"
            class="absolute top-1.5 end-1.5"
          />
        </NuxtLink>
      </nav>

      <div class="flex items-center gap-2">
        <div class="flex-1 grid grid-cols-3 gap-1 rounded-lg bg-elevated p-1">
          <button
            v-for="l in languages"
            :key="l.code"
            type="button"
            class="rounded-md py-1.5 text-xs font-bold cursor-pointer"
            :class="locale === l.code ? 'bg-default text-highlighted shadow-xs' : 'text-muted'"
            @click="choose(l.code)"
          >
            {{ l.name }}
          </button>
        </div>
        <UButton
          :icon="dark ? 'i-lucide-sun' : 'i-lucide-moon'"
          color="neutral"
          variant="outline"
          square
          :aria-label="dark ? t('nav.lightMode') : t('nav.darkMode')"
          @click="colorMode.preference = dark ? 'light' : 'dark'"
        />
      </div>

      <UButton
        to="https://t.me/javlon_developer"
        target="_blank"
        rel="noopener"
        :label="t('nav.telegramSupport')"
        icon="i-simple-icons-telegram"
        trailing-icon="i-lucide-external-link"
        color="primary"
        variant="soft"
        block
      />

      <UButton
        :label="t('nav.logOut')"
        icon="i-lucide-log-out"
        color="error"
        variant="soft"
        block
        @click="logout"
      />
    </template>
  </UDrawer>
</template>
