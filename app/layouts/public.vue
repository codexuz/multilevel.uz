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

const socials = [
  { label: 'Impulse LC on Telegram', icon: 'i-simple-icons-telegram', to: 'https://t.me/impulse_lc' },
  { label: 'Speak Up Impulse on Telegram', icon: 'i-simple-icons-telegram', to: 'https://t.me/speakup_impulse' },
  { label: 'Impulse LC on YouTube', icon: 'i-simple-icons-youtube', to: 'https://youtube.com/@impulse_lc' },
  { label: 'Impulse Study on Instagram', icon: 'i-simple-icons-instagram', to: 'https://instagram.com/impulsestudy_lc' }
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
          <img
            src="/logo.png"
            alt=""
            class="size-6 object-contain"
          >
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

      <template #right>
        <UButton
          v-for="social in socials"
          :key="social.to"
          :to="social.to"
          :icon="social.icon"
          :aria-label="social.label"
          :title="social.label"
          target="_blank"
          rel="noopener noreferrer"
          color="neutral"
          variant="ghost"
        />
      </template>
    </UFooter>
  </div>
</template>
