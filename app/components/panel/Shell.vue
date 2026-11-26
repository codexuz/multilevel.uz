<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'

const props = defineProps<{
  kind: 'admin' | 'teacher'
  panelLabel: string
  homeTo: string
  navItems: NavigationMenuItem[]
}>()

const route = useRoute()
const { me } = useMe()
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

const displayName = computed(() => me.value?.name || accountHandle(me.value) || props.panelLabel)

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  reloadNuxtApp({ path: '/' })
}

const userMenu = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: displayName.value, avatar: { src: me.value?.avatarUrl ?? undefined, alt: displayName.value }, description: accountHandle(me.value) }],
  [
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
            color="neutral"
            variant="outline"
            size="sm"
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

        <UNavigationMenu
          :collapsed="collapsed"
          :items="[
            {
              label: t('nav.support'),
              icon: 'i-lucide-life-buoy',
              defaultOpen: route.path === '/support',
              active: route.path === '/support',
              children: [
                { label: t('nav.reportFeedback'), icon: 'i-lucide-message-square-warning', to: '/support', active: route.path === '/support' },
                { label: t('nav.telegramSupport'), icon: 'i-simple-icons-telegram', to: 'https://t.me/javlon_developer', target: '_blank' }
              ]
            },
            { label: t('nav.settings'), icon: 'i-lucide-settings', to: '/settings', active: route.path === '/settings' }
          ]"
          orientation="vertical"
          tooltip
          popover
          class="mt-auto"
        />
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
