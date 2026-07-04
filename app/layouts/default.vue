<script setup lang="ts">
const user = useSupabaseUser()
const supabase = useSupabaseClient()
const { profile, isStaff } = useProfile()

const links = computed(() => [
  { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/dashboard' },
  { label: 'Tests', icon: 'i-lucide-clipboard-list', to: '/tests' },
  { label: 'Speaking Live', icon: 'i-lucide-mic', to: '/speaking/live' }
])

async function signOut() {
  await supabase.auth.signOut()
  await navigateTo('/login')
}

const userItems = computed(() => [[
  { label: profile.value?.full_name || user.value?.email || 'Account', type: 'label' as const }
], [
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
        <NuxtLink
          to="/dashboard"
          class="flex items-center gap-2 font-bold text-lg"
        >
          <UIcon
            name="i-lucide-graduation-cap"
            class="size-6 text-primary"
          />
          <span>Multilevel</span>
        </NuxtLink>
      </template>

      <UNavigationMenu
        :items="links"
        variant="link"
      />

      <template #right>
        <UColorModeButton />
        <UDropdownMenu
          v-if="user"
          :items="userItems"
        >
          <UButton
            :avatar="{ src: profile?.avatar_url || undefined, alt: profile?.full_name || 'User' }"
            color="neutral"
            variant="ghost"
            trailing-icon="i-lucide-chevron-down"
          />
        </UDropdownMenu>
        <UButton
          v-else
          to="/login"
          label="Sign in"
          color="primary"
        />
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
