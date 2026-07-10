<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'

const { me, isStaff } = useMe()
const colorMode = useColorMode()

// `open` drives the desktop expand/collapse and, on mobile, the slide-over.
const open = ref(true)
const route = useRoute()
watch(() => route.fullPath, () => {
  if (import.meta.client && window.innerWidth < 1024) open.value = false
})

function toggleSidebar() {
  open.value = !open.value
}

const links = computed<NavigationMenuItem[]>(() => [
  { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/dashboard' },
  { label: 'Courses', icon: 'i-lucide-graduation-cap', to: '/courses' },
  { label: 'Tests', icon: 'i-lucide-clipboard-list', to: '/tests' },
  { label: 'Speaking Live', icon: 'i-lucide-mic', to: '/speaking/live' },
  { label: 'Community', icon: 'i-lucide-messages-square', to: '/community' },
  { label: 'Leaderboard', icon: 'i-lucide-trophy', to: '/leaderboard' }
])

const secondaryLinks = computed<NavigationMenuItem[]>(() => [
  { label: 'Profile', icon: 'i-lucide-user', to: '/profile' },
  { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' },
  ...(isStaff.value ? [{ label: 'Admin panel', icon: 'i-lucide-shield', to: '/admin' }] : []),
  { label: 'Upgrade', icon: 'i-lucide-sparkles', to: '/upgrade' }
])

async function signOut() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await navigateTo('/login')
  reloadNuxtApp({ path: '/login' })
}

const userItems = computed<DropdownMenuItem[][]>(() => [
  [
    { label: me.value?.name || me.value?.email || 'Account', type: 'label' as const }
  ],
  // Only entry point for these — the sidebar carries the primary links.
  secondaryLinks.value as DropdownMenuItem[],
  [
    {
      label: 'Appearance',
      icon: 'i-lucide-sun-moon',
      children: [
        {
          label: 'Light',
          icon: 'i-lucide-sun',
          type: 'checkbox' as const,
          checked: colorMode.value === 'light',
          onUpdateChecked(checked: boolean) {
            if (checked) colorMode.preference = 'light'
          },
          onSelect(e: Event) {
            e.preventDefault()
          }
        },
        {
          label: 'Dark',
          icon: 'i-lucide-moon',
          type: 'checkbox' as const,
          checked: colorMode.value === 'dark',
          onUpdateChecked(checked: boolean) {
            if (checked) colorMode.preference = 'dark'
          },
          onSelect(e: Event) {
            e.preventDefault()
          }
        }
      ]
    }
  ],
  [
    { label: 'Sign out', icon: 'i-lucide-log-out', onSelect: signOut }
  ]
])
</script>

<template>
  <div class="min-h-screen flex flex-1">
    <USidebar
      v-model:open="open"
      collapsible="icon"
      rail
      title="Multilevel"
      description="Main navigation"
      :ui="{
        container: 'h-full',
        inner: 'bg-elevated/25 divide-transparent',
        body: 'py-0'
      }"
    >
      <template #header>
        <UButton
          to="/dashboard"
          label="Multilevel"
          color="neutral"
          variant="ghost"
          square
          class="w-full overflow-hidden font-bold"
        >
          <template #leading>
            <img
              src="/logo.png"
              alt=""
              class="size-5 shrink-0 object-contain"
            >
          </template>
        </UButton>
      </template>

      <template #default="{ state }">
        <UNavigationMenu
          :key="state"
          :items="links"
          orientation="vertical"
          :ui="{ link: 'p-1.5 overflow-hidden' }"
        />
      </template>

      <template #footer="{ state }">
        <UDropdownMenu
          v-if="me"
          :items="userItems"
          :content="{ align: 'center', collisionPadding: 12 }"
          :ui="{ content: 'w-(--reka-dropdown-menu-trigger-width) min-w-48' }"
        >
          <UButton
            :avatar="{ src: me.avatarUrl || undefined, alt: me.name || 'User' }"
            :label="state === 'expanded' ? (me.name || me.email || 'Account') : undefined"
            trailing-icon="i-lucide-chevrons-up-down"
            color="neutral"
            variant="ghost"
            square
            class="w-full data-[state=open]:bg-elevated overflow-hidden"
            :ui="{ trailingIcon: 'text-dimmed ms-auto' }"
          />
        </UDropdownMenu>
        <UButton
          v-else
          to="/login"
          icon="i-lucide-log-in"
          :label="state === 'expanded' ? 'Sign in' : undefined"
          color="primary"
          block
        />
      </template>
    </USidebar>

    <div class="flex-1 min-w-0 flex flex-col">
      <div class="h-(--ui-header-height) shrink-0 flex items-center gap-2 px-4 border-b border-default">
        <UButton
          icon="i-lucide-panel-left"
          color="neutral"
          variant="ghost"
          aria-label="Toggle sidebar"
          @click="toggleSidebar"
        />

        <div
          v-if="me"
          class="ml-auto flex items-center gap-3 text-sm"
        >
          <span
            class="flex items-center gap-1"
            title="Streak"
          >🔥 {{ me.streakCount }}</span>
          <span
            class="flex items-center gap-1 text-primary"
            title="Points"
          >
            <UIcon
              name="i-lucide-star"
              class="size-4"
            />{{ me.points }}
          </span>
          <span
            class="flex items-center gap-1 text-amber-500"
            title="Coins"
          >
            <UIcon
              name="i-lucide-coins"
              class="size-4"
            />{{ me.coins }}
          </span>
        </div>
      </div>

      <UMain class="flex-1">
        <slot />
      </UMain>
    </div>
  </div>
</template>
