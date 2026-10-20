<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'

// The erp-lms IELTS app's shell (layouts/default.vue there), open to guests: anyone can browse and
// take tests; signing in keeps the results, and staff get the builder and marking.
const { me, loggedIn, isStaff, isAdmin } = useMe()
const colorMode = useColorMode()
const route = useRoute()

const mainNav = computed<NavigationMenuItem[]>(() => [
  { label: 'Home', icon: 'i-lucide-house', to: '/' },
  { label: 'Tests', icon: 'i-lucide-clipboard-list', to: '/tests' },
  ...(loggedIn.value ? [{ label: 'My results', icon: 'i-lucide-chart-column', to: '/results' }] : [])
])

const staffNav = computed<NavigationMenuItem[]>(() => [
  ...(isAdmin.value ? [{ label: 'Test builder', icon: 'i-lucide-blocks', to: '/builder' }] : []),
  ...(isStaff.value ? [{ label: 'Marking', icon: 'i-lucide-pen-line', to: '/marking' }] : []),
  ...(isAdmin.value ? [{ label: 'Users', icon: 'i-lucide-users', to: '/admin/users' }] : []),
  ...(isStaff.value ? [{ label: 'Overview', icon: 'i-lucide-layout-dashboard', to: '/admin' }] : [])
])

const nearestTo = computed(() => [...mainNav.value, ...staffNav.value]
  .map(i => String(i.to))
  .filter(to => route.path === to || (to !== '/' && route.path.startsWith(`${to}/`)))
  .sort((a, b) => b.length - a.length)[0])
const mark = (items: NavigationMenuItem[]) => items.map(i => ({ ...i, active: String(i.to) === nearestTo.value }))

const bottomLinks = computed<NavigationMenuItem[]>(() => loggedIn.value
  ? [{ label: 'Profile', icon: 'i-lucide-user', to: '/profile' }, { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' }]
  : [])

const displayName = computed(() => me.value?.name || me.value?.email || 'Account')

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  reloadNuxtApp({ path: '/' })
}

const userMenu = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: displayName.value, avatar: { src: me.value?.avatarUrl ?? undefined, alt: displayName.value }, description: me.value?.email }],
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
        <AppLogo :collapsed="collapsed" />
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
  </UDashboardGroup>
</template>
