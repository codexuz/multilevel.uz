<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

// Marketing shell for the routes reachable signed out. No sidebar — navigation
// is a flat header menu plus a single sign-in CTA.
const { me } = useMe()

const links: NavigationMenuItem[] = [
  { label: 'Home', icon: 'i-lucide-home', to: '/' },
  { label: 'Courses', icon: 'i-lucide-graduation-cap', to: '/courses' },
  { label: 'Tests', icon: 'i-lucide-clipboard-list', to: '/tests' },
  { label: 'Pricing', icon: 'i-lucide-sparkles', to: '/upgrade' }
]
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <UHeader>
      <template #left>
        <NuxtLink
          to="/"
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
        <UButton
          v-if="me"
          to="/dashboard"
          label="Dashboard"
          color="primary"
        />
        <UButton
          v-else
          to="/login"
          label="Sign in"
          color="primary"
        />
      </template>

      <!-- Mobile slide-over menu (opened by the auto hamburger toggle) -->
      <template #body>
        <UNavigationMenu
          :items="links"
          orientation="vertical"
          class="-mx-2.5"
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
