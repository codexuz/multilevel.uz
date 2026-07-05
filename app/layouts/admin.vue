<script setup lang="ts">
const { me, isAdmin } = useMe()

const items = computed(() => [{
  label: 'Overview', icon: 'i-lucide-gauge', to: '/admin'
}, {
  label: 'Tests', icon: 'i-lucide-clipboard-list', to: '/admin/tests'
}, {
  label: 'Grading', icon: 'i-lucide-check-check', to: '/admin/grading'
}, ...(isAdmin.value
  ? [{
      label: 'Users', icon: 'i-lucide-users', to: '/admin/users'
    }]
  : [])])

async function signOut() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await navigateTo('/login')
  reloadNuxtApp({ path: '/login' })
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <UHeader>
      <template #left>
        <NuxtLink
          to="/admin"
          class="flex items-center gap-2 font-bold text-lg"
        >
          <UIcon
            name="i-lucide-shield"
            class="size-6 text-primary"
          />
          <span>Admin</span>
        </NuxtLink>
      </template>
      <template #right>
        <UButton
          to="/dashboard"
          icon="i-lucide-arrow-left"
          variant="ghost"
          color="neutral"
          label="Student view"
        />
        <UColorModeButton />
        <UButton
          icon="i-lucide-log-out"
          variant="ghost"
          color="neutral"
          @click="signOut"
        />
      </template>
    </UHeader>

    <div class="flex-1 w-full max-w-[90rem] mx-auto flex gap-6 px-4 sm:px-6 py-6">
      <aside class="hidden lg:block w-56 shrink-0">
        <UNavigationMenu
          orientation="vertical"
          :items="items"
        />
        <USeparator class="my-4" />
        <p class="text-xs text-muted px-2">
          Signed in as {{ me?.name || 'staff' }} ({{ me?.role }})
        </p>
      </aside>
      <main class="flex-1 min-w-0">
        <slot />
      </main>
    </div>
  </div>
</template>
