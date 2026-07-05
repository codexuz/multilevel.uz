<script setup lang="ts">
const { me, isStaff } = useMe()

const links = computed(() => [
  { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/dashboard' },
  { label: 'Tests', icon: 'i-lucide-clipboard-list', to: '/tests' },
  { label: 'Speaking Live', icon: 'i-lucide-mic', to: '/speaking/live' },
  { label: 'Leaderboard', icon: 'i-lucide-trophy', to: '/leaderboard' }
])

async function signOut() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await navigateTo('/login')
  reloadNuxtApp({ path: '/login' })
}

const userItems = computed(() => [[
  { label: me.value?.name || me.value?.email || 'Account', type: 'label' as const }
], [
  { label: 'Profile', icon: 'i-lucide-user', to: '/profile' },
  { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' },
  ...(isStaff.value ? [{ label: 'Admin panel', icon: 'i-lucide-shield', to: '/admin' }] : []),
  { label: 'Upgrade', icon: 'i-lucide-sparkles', to: '/upgrade' }
], [
  { label: 'Sign out', icon: 'i-lucide-log-out', onSelect: signOut }
]])
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <UHeader>
      <template #left>
        <NuxtLink to="/dashboard" class="flex items-center gap-2 font-bold text-lg">
          <UIcon name="i-lucide-graduation-cap" class="size-6 text-primary" />
          <span>Multilevel</span>
        </NuxtLink>
      </template>

      <UNavigationMenu :items="links" variant="link" />

      <template #right>
        <template v-if="me">
          <div class="hidden sm:flex items-center gap-3 mr-1 text-sm">
            <span class="flex items-center gap-1" title="Streak">🔥 {{ me.streakCount }}</span>
            <span class="flex items-center gap-1 text-primary" title="Points">
              <UIcon name="i-lucide-star" class="size-4" />{{ me.points }}
            </span>
            <span class="flex items-center gap-1 text-amber-500" title="Coins">
              <UIcon name="i-lucide-coins" class="size-4" />{{ me.coins }}
            </span>
          </div>
        </template>
        <UColorModeButton />
        <UDropdownMenu v-if="me" :items="userItems">
          <UButton
            :avatar="{ src: me.avatarUrl || undefined, alt: me.name || 'User' }"
            color="neutral"
            variant="ghost"
            trailing-icon="i-lucide-chevron-down"
          />
        </UDropdownMenu>
        <UButton v-else to="/login" label="Sign in" color="primary" />
      </template>
    </UHeader>

    <UMain class="flex-1">
      <slot />
    </UMain>

    <USeparator />
    <UFooter>
      <template #left>
        <p class="text-sm text-muted">
          © {{ new Date().getFullYear() }} Multilevel Exam Prep
        </p>
      </template>
    </UFooter>
  </div>
</template>
