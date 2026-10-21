<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'

// The erp-lms IELTS app's shell (layouts/default.vue there), open to guests: anyone can browse and
// take tests; signing in keeps the results, and staff get the builder and marking.
const { me, loggedIn, isPremium, rewardCredits } = useMe()
const { live } = useLiveMock()
const colorMode = useColorMode()
const route = useRoute()

const mainNav = computed<NavigationMenuItem[]>(() => [
  { label: 'Tests', icon: 'i-lucide-clipboard-list', to: '/tests' },
  { label: 'Live mock', icon: 'i-lucide-trophy', to: '/live', badge: live.value ? { label: 'Live', color: 'error' as const, variant: 'subtle' as const, size: 'sm' as const } : undefined },
  ...(loggedIn.value ? [{ label: 'My results', icon: 'i-lucide-chart-column', to: '/results' }] : []),
  { label: 'Premium', icon: 'i-lucide-sparkles', to: '/pricing', badge: isPremium.value ? { label: 'On', color: 'success' as const, variant: 'subtle' as const, size: 'sm' as const } : undefined },
  { label: 'Earn credits', icon: 'i-lucide-gift', to: '/earn', badge: rewardCredits.value ? { label: String(rewardCredits.value), color: 'primary' as const, variant: 'subtle' as const, size: 'sm' as const } : undefined }
])

const staffNav = useStaffNav()

const nearestTo = computed(() => [...mainNav.value, ...staffNav.value]
  .map(i => String(i.to))
  .filter(to => route.path === to || (to !== '/' && route.path.startsWith(`${to}/`)))
  .sort((a, b) => b.length - a.length)[0])
const mark = (items: NavigationMenuItem[]) => items.map(i => ({ ...i, active: String(i.to) === nearestTo.value }))

const bottomLinks = computed<NavigationMenuItem[]>(() => loggedIn.value
  ? [{ label: 'Profile', icon: 'i-lucide-user', to: '/profile' }, { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' }]
  : [])

// The phone's tab bar: the places a candidate goes most, one tap away (staff pages stay in the menu).
const tabBar = computed(() => [
  { label: 'Tests', icon: 'i-lucide-clipboard-list', to: '/tests' },
  ...(loggedIn.value
    ? [{ label: 'Results', icon: 'i-lucide-chart-column', to: '/results' }, { label: 'Premium', icon: 'i-lucide-sparkles', to: '/pricing' }, { label: 'Profile', icon: 'i-lucide-circle-user', to: '/profile' }]
    : [{ label: 'Sign in', icon: 'i-lucide-log-in', to: `/login?next=${encodeURIComponent(route.fullPath)}` }])
])
const tabActive = (to: string) => (to === '/' ? route.path === '/' : route.path === to.split('?')[0] || route.path.startsWith(`${to}/`))

const displayName = computed(() => me.value?.name || accountHandle(me.value) || 'Account')

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  reloadNuxtApp({ path: '/' })
}

const userMenu = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: displayName.value, avatar: { src: me.value?.avatarUrl ?? undefined, alt: displayName.value }, description: accountHandle(me.value) }],
  [
    { label: 'Profile', icon: 'i-lucide-user', to: '/profile' },
    { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' },
    {
      label: colorMode.value === 'dark' ? 'Light mode' : 'Dark mode',
      icon: colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon',
      onSelect: (e: Event) => {
        e.preventDefault()
        colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
      }
    }
  ],
  [{ label: 'Log out', icon: 'i-lucide-log-out', color: 'error', onSelect: () => logout() }]
])
</script>

<template>
  <UDashboardGroup
    unit="rem"
    storage="local"
  >
    <UDashboardSidebar
      id="main"
      collapsible
      resizable
      :default-size="15"
      :min-size="12"
      :max-size="20"
      :ui="{ footer: 'border-t border-default' }"
    >
      <template #header="{ collapsed }">
        <AppLogo
          :collapsed="collapsed"
          to="/tests"
        />
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="mark(mainNav)"
          orientation="vertical"
          tooltip
          popover
        />
        <template v-if="staffNav.length">
          <p
            v-if="!collapsed"
            class="px-2.5 pt-4 pb-1 text-xs font-medium text-dimmed"
          >
            Staff
          </p>
          <UNavigationMenu
            :collapsed="collapsed"
            :items="mark(staffNav)"
            orientation="vertical"
            tooltip
            popover
          />
        </template>
        <UNavigationMenu
          :collapsed="collapsed"
          :items="mark(bottomLinks)"
          orientation="vertical"
          tooltip
          class="mt-auto"
        />
      </template>

      <template #footer="{ collapsed }">
        <UDropdownMenu
          v-if="loggedIn"
          :items="userMenu"
          :content="{ align: 'center', collisionPadding: 12 }"
          :ui="{ content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)' }"
        >
          <UButton
            :avatar="{ src: me?.avatarUrl ?? undefined, alt: displayName }"
            :label="collapsed ? undefined : displayName"
            :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
            color="neutral"
            variant="ghost"
            block
            :square="collapsed"
            class="data-[state=open]:bg-elevated"
          />
        </UDropdownMenu>
        <div
          v-else
          class="w-full flex flex-col gap-2"
        >
          <UButton
            :to="`/login?next=${encodeURIComponent(route.fullPath)}`"
            icon="i-lucide-log-in"
            :label="collapsed ? undefined : 'Sign in'"
            :square="collapsed"
            block
          />
          <UColorModeButton
            v-if="!collapsed"
            class="self-center"
          />
        </div>
      </template>
    </UDashboardSidebar>

    <slot />

    <ClientOnly>
      <TelegramBotPrompt />
    </ClientOnly>

    <nav
      class="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-default bg-default/95 backdrop-blur-xl pb-safe"
      aria-label="Main"
    >
      <div class="mx-auto max-w-lg grid grid-flow-col auto-cols-fr">
        <NuxtLink
          v-for="t in tabBar"
          :key="t.label"
          :to="t.to"
          :aria-label="t.label"
          :title="t.label"
          class="relative flex flex-col items-center justify-center gap-1 h-14 transition-colors"
          :class="tabActive(t.to) ? 'text-highlighted' : 'text-dimmed hover:text-toned'"
        >
          <UIcon
            :name="t.icon"
            class="size-6"
          />
          <span
            class="h-0.5 w-5 rounded-full transition-colors"
            :class="tabActive(t.to) ? 'bg-inverted' : 'bg-transparent'"
          />
        </NuxtLink>
      </div>
    </nav>
  </UDashboardGroup>
</template>
