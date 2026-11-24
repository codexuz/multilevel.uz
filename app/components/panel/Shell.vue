<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'

const props = defineProps<{
  kind: 'admin' | 'teacher'
  panelLabel: string
  homeTo: string
  navItems: NavigationMenuItem[]
}>()

const route = useRoute()
const { me, isAdmin } = useMe()
const { t } = useI18n()
const { locale, languages, choose } = useLanguage()
const colorMode = useColorMode()

function isPathActive(to?: unknown): boolean {
  if (!to || typeof to !== 'string') return false
  const [path, queryStr] = to.split('?')
  if (queryStr) {
    if (route.path !== path) return false
    const params = new URLSearchParams(queryStr)
    for (const [k, v] of params.entries()) {
      if (String(route.query[k] ?? '') !== v) return false
    }
    return true
  }
  if (path === '/admin' || path === '/teacher') return route.path === path
  return route.path === path || route.path.startsWith(`${path}/`)
}

const markedNav = computed<NavigationMenuItem[]>(() => props.navItems.map((item) => {
  if (item.children?.length) {
    const children = item.children.map(c => ({ ...c, active: isPathActive(c.to) }))
    const anyActive = children.some(c => c.active)
    return { ...item, defaultOpen: anyActive || item.defaultOpen, active: anyActive, children }
  }
  return { ...item, active: isPathActive(item.to) }
}))

const displayName = computed(() => me.value?.name || accountHandle(me.value) || (props.kind === 'admin' ? 'Admin' : 'Teacher'))

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  reloadNuxtApp({ path: '/' })
}

const userMenu = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: displayName.value, avatar: { src: me.value?.avatarUrl ?? undefined, alt: displayName.value }, description: accountHandle(me.value) }],
  [
    ...(props.kind !== 'admin' && isAdmin.value ? [{ label: 'Admin Panel', icon: 'i-lucide-shield-check', to: '/admin' }] : []),
    ...(props.kind !== 'teacher' ? [{ label: 'Teacher Panel', icon: 'i-lucide-school', to: '/teacher' }] : []),
    { label: 'Student View', icon: 'i-lucide-compass', to: '/dashboard' }
  ],
  [
    { label: t('nav.profile'), icon: 'i-lucide-user', to: '/profile' },
    { label: t('nav.settings'), icon: 'i-lucide-settings', to: '/settings' },
    {
      label: t('lang.label'),
      icon: 'i-lucide-languages',
      children: languages.value.map(l => ({ label: l.name, type: 'checkbox' as const, checked: locale.value === l.code, onUpdateChecked: () => choose(l.code) }))
    },
    {
      label: colorMode.value === 'dark' ? t('nav.lightMode') : t('nav.darkMode'),
      icon: colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon',
      onSelect: (e: Event) => {
        e.preventDefault()
        colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
      }
    }
  ],
  [{ label: t('nav.logOut'), icon: 'i-lucide-log-out', color: 'error', onSelect: () => logout() }]
])
</script>

<template>
  <UDashboardGroup
    unit="rem"
    storage="local"
  >
    <UDashboardSidebar
      :id="kind"
      collapsible
      resizable
      :default-size="15.5"
      :min-size="12"
      :max-size="20"
      :ui="{ footer: 'border-t border-default' }"
    >
      <template #header="{ collapsed }">
        <div class="flex items-center justify-between gap-2 w-full">
          <AppLogo
            :collapsed="collapsed"
            :to="homeTo"
          />
          <UBadge
            v-if="!collapsed"
            :label="panelLabel"
            :color="kind === 'admin' ? 'primary' : 'info'"
            variant="subtle"
            size="xs"
          />
        </div>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="markedNav"
          orientation="vertical"
          tooltip
          popover
        />

        <!-- Workspace Switcher -->
        <div class="mt-auto pt-3 border-t border-default flex flex-col gap-1.5">
          <p
            v-if="!collapsed"
            class="px-2.5 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-dimmed"
          >
            Workspaces
          </p>
          <UButton
            v-if="kind === 'admin'"
            to="/teacher"
            icon="i-lucide-school"
            :label="collapsed ? undefined : 'Teacher Panel'"
            :square="collapsed"
            color="primary"
            variant="soft"
            size="sm"
            block
            class="justify-start"
          />
          <UButton
            v-else-if="isAdmin"
            to="/admin"
            icon="i-lucide-shield-check"
            :label="collapsed ? undefined : 'Admin Panel'"
            :square="collapsed"
            color="primary"
            variant="soft"
            size="sm"
            block
            class="justify-start"
          />
          <UButton
            to="/dashboard"
            icon="i-lucide-compass"
            :label="collapsed ? undefined : 'Student View'"
            :square="collapsed"
            color="neutral"
            variant="ghost"
            size="sm"
            block
            class="justify-start"
          />
        </div>
      </template>

      <template #footer="{ collapsed }">
        <UDropdownMenu
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
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
