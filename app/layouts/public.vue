<script setup lang="ts">
/**
 * The public site, in the manner of SmallTalk2Me's: a header with the main links and the way in,
 * the page, and a dark footer. No sidebar and no phone tab bar; on a phone the links open from a
 * menu. The home page always wears it; the catalogue, a test's page and Premium wear it for guests.
 */
provide(PUBLIC_LAYOUT, true)

const { me, loggedIn } = useMe()
const route = useRoute()
const config = useRuntimeConfig()
const menuOpen = ref(false)
watch(() => route.fullPath, () => (menuOpen.value = false))

const links = [
  { label: 'Tests', to: '/tests' },
  { label: 'Premium', to: '/pricing' },
  { label: 'How it works', to: '/#how' },
  { label: 'FAQ', to: '/#faq' }
]
const isActive = (to: string) => !to.includes('#') && (route.path === to || route.path.startsWith(`${to}/`))
const signInTo = computed(() => `/login?next=${encodeURIComponent(route.path === '/' ? '/tests' : route.fullPath)}`)
const social = config.public.socialLinks as { telegramUrl: string, youtubeUrl: string }
const year = new Date().getFullYear()
</script>

<template>
  <div class="min-h-dvh flex flex-col bg-default">
    <header class="sticky top-0 z-40 border-b border-default/70 bg-default/85 backdrop-blur-xl">
      <div class="mx-auto max-w-6xl h-16 px-4 sm:px-6 lg:px-8 flex items-center gap-6">
        <AppLogo />

        <nav
          class="hidden md:flex items-center gap-1 ms-4"
          aria-label="Main"
        >
          <NuxtLink
            v-for="l in links"
            :key="l.to"
            :to="l.to"
            class="px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
            :class="isActive(l.to) ? 'text-primary' : 'text-toned hover:text-highlighted'"
          >
            {{ l.label }}
          </NuxtLink>
        </nav>

        <div class="ms-auto flex items-center gap-2">
          <template v-if="loggedIn">
            <UButton
              to="/results"
              label="My results"
              color="neutral"
              variant="ghost"
              class="hidden sm:inline-flex font-semibold"
            />
            <UButton
              to="/tests"
              label="Open app"
              class="rounded-full px-5 font-semibold hidden sm:inline-flex"
            />
            <NuxtLink
              to="/profile"
              class="shrink-0"
              aria-label="Profile"
            >
              <UAvatar
                :src="me?.avatarUrl || undefined"
                :alt="me?.name || 'Profile'"
                size="md"
              />
            </NuxtLink>
          </template>
          <template v-else>
            <UButton
              :to="signInTo"
              label="Sign in"
              color="neutral"
              variant="outline"
              class="rounded-full px-5 font-semibold ring-2 ring-inverted/90 hidden sm:inline-flex"
            />
            <UButton
              to="/tests"
              label="Start now"
              class="rounded-full px-5 font-semibold"
            />
          </template>
          <UButton
            icon="i-lucide-menu"
            color="neutral"
            variant="ghost"
            class="md:hidden"
            aria-label="Open menu"
            @click="menuOpen = true"
          />
        </div>
      </div>
    </header>

    <USlideover
      v-model:open="menuOpen"
      side="right"
      :ui="{ content: 'max-w-xs' }"
      title="Menu"
    >
      <template #body>
        <nav
          class="flex flex-col gap-1"
          aria-label="Main"
        >
          <NuxtLink
            v-for="l in links"
            :key="l.to"
            :to="l.to"
            class="px-3 py-3 rounded-lg text-base font-semibold"
            :class="isActive(l.to) ? 'text-primary bg-primary/8' : 'text-highlighted hover:bg-elevated'"
          >
            {{ l.label }}
          </NuxtLink>
        </nav>
        <USeparator class="my-4" />
        <div class="flex flex-col gap-2">
          <template v-if="loggedIn">
            <UButton
              to="/tests"
              label="Open app"
              size="lg"
              block
            />
            <UButton
              to="/results"
              label="My results"
              color="neutral"
              variant="outline"
              size="lg"
              block
            />
          </template>
          <template v-else>
            <UButton
              to="/tests"
              label="Start now"
              size="lg"
              block
            />
            <UButton
              :to="signInTo"
              label="Sign in"
              color="neutral"
              variant="outline"
              size="lg"
              block
            />
          </template>
        </div>
      </template>
    </USlideover>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="bg-[#16151d] text-white/70">
      <div class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div class="flex flex-col gap-4">
          <NuxtLink
            to="/"
            class="flex items-center gap-2 text-white font-semibold text-lg"
          >
            <img
              src="/logo.png"
              alt=""
              class="size-7 rounded-md"
            >Multilevel
          </NuxtLink>
          <p class="text-sm max-w-xs">
            Free Multilevel (CEFR) English mock tests, checked instantly, with a score out of 75 and your level.
          </p>
          <div class="flex gap-2">
            <UButton
              :to="social.telegramUrl"
              target="_blank"
              icon="i-simple-icons-telegram"
              color="neutral"
              variant="ghost"
              class="text-white/80 hover:text-white hover:bg-white/10"
              aria-label="Telegram"
            />
            <UButton
              :to="social.youtubeUrl"
              target="_blank"
              icon="i-simple-icons-youtube"
              color="neutral"
              variant="ghost"
              class="text-white/80 hover:text-white hover:bg-white/10"
              aria-label="YouTube"
            />
          </div>
        </div>
        <div>
          <p class="text-sm font-semibold text-white mb-3">
            Practise
          </p>
          <ul class="flex flex-col gap-2 text-sm">
            <li>
              <NuxtLink
                to="/tests"
                class="hover:text-white"
              >All tests</NuxtLink>
            </li>
            <li
              v-for="s in ['Listening', 'Reading', 'Writing', 'Speaking']"
              :key="s"
            >
              <NuxtLink
                to="/tests"
                class="hover:text-white"
              >{{ s }}</NuxtLink>
            </li>
          </ul>
        </div>
        <div>
          <p class="text-sm font-semibold text-white mb-3">
            Multilevel
          </p>
          <ul class="flex flex-col gap-2 text-sm">
            <li>
              <NuxtLink
                to="/pricing"
                class="hover:text-white"
              >Premium</NuxtLink>
            </li>
            <li>
              <NuxtLink
                to="/#how"
                class="hover:text-white"
              >How it works</NuxtLink>
            </li>
            <li>
              <NuxtLink
                to="/#faq"
                class="hover:text-white"
              >FAQ</NuxtLink>
            </li>
          </ul>
        </div>
        <div>
          <p class="text-sm font-semibold text-white mb-3">
            Account
          </p>
          <ul class="flex flex-col gap-2 text-sm">
            <template v-if="loggedIn">
              <li>
                <NuxtLink
                  to="/results"
                  class="hover:text-white"
                >My results</NuxtLink>
              </li>
              <li>
                <NuxtLink
                  to="/profile"
                  class="hover:text-white"
                >Profile</NuxtLink>
              </li>
            </template>
            <li v-else>
              <NuxtLink
                :to="signInTo"
                class="hover:text-white"
              >Sign in</NuxtLink>
            </li>
            <li>
              <a
                :href="social.telegramUrl"
                target="_blank"
                rel="noopener"
                class="hover:text-white"
              >Contact us</a>
            </li>
          </ul>
        </div>
      </div>
      <div class="border-t border-white/10">
        <p class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-5 text-xs text-white/50">
          © {{ year }} multilevel.uz
        </p>
      </div>
    </footer>
  </div>
</template>
