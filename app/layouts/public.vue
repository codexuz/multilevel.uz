<script setup lang="ts">
/**
 * The public site, in the manner of SmallTalk2Me's: a header with the main links and the way in,
 * the page, and a dark footer. No sidebar and no phone tab bar; on a phone the links open from a
 * menu. The home page always wears it; the catalogue, a test's page and Premium wear it for guests.
 */
provide(PUBLIC_LAYOUT, true)

const { me, loggedIn } = useMe()
const { t } = useI18n()
const route = useRoute()
const config = useRuntimeConfig()
const menuOpen = ref(false)
watch(() => route.fullPath, () => (menuOpen.value = false))

const links = computed(() => [
  { label: t('nav.exams'), to: '/#exams' },
  { label: t('nav.tests'), to: '/tests' },
  { label: t('nav.premium'), to: '/pricing' },
  { label: t('nav.centres'), to: '/centres' },
  { label: t('pub.how'), to: '/#how' },
  { label: t('pub.faq'), to: '/#faq' }
])
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
          :aria-label="t('nav.main')"
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
              :label="t('nav.results')"
              color="neutral"
              variant="ghost"
              class="hidden sm:inline-flex font-semibold"
            />
            <UButton
              to="/tests"
              :label="t('pub.openApp')"
              class="rounded-full px-5 font-semibold hidden sm:inline-flex"
            />
            <NuxtLink
              to="/profile"
              class="shrink-0"
              :aria-label="t('nav.profile')"
            >
              <UAvatar
                :src="me?.avatarUrl || undefined"
                :alt="me?.name || t('nav.profile')"
                size="md"
              />
            </NuxtLink>
          </template>
          <template v-else>
            <UButton
              :to="signInTo"
              :label="t('nav.signIn')"
              color="neutral"
              variant="outline"
              class="rounded-full px-5 font-semibold ring-2 ring-inverted/90 hidden sm:inline-flex"
            />
            <UButton
              to="/tests"
              :label="t('pub.startNow')"
              class="rounded-full px-5 font-semibold"
            />
          </template>
          <LanguageSwitcher class="hidden sm:inline-flex" />
          <UButton
            icon="i-lucide-menu"
            color="neutral"
            variant="ghost"
            class="md:hidden"
            :aria-label="t('pub.openMenu')"
            @click="menuOpen = true"
          />
        </div>
      </div>
    </header>

    <USlideover
      v-model:open="menuOpen"
      side="right"
      :ui="{ content: 'max-w-xs' }"
      :title="t('pub.menu')"
    >
      <template #body>
        <nav
          class="flex flex-col gap-1"
          :aria-label="t('nav.main')"
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
        <LanguageSwitcher class="mb-3" />
        <div class="flex flex-col gap-2">
          <template v-if="loggedIn">
            <UButton
              to="/tests"
              :label="t('pub.openApp')"
              size="lg"
              block
            />
            <UButton
              to="/results"
              :label="t('nav.results')"
              color="neutral"
              variant="outline"
              size="lg"
              block
            />
          </template>
          <template v-else>
            <UButton
              to="/tests"
              :label="t('pub.startNow')"
              size="lg"
              block
            />
            <UButton
              :to="signInTo"
              :label="t('nav.signIn')"
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
              src="/icon.svg"
              alt=""
              class="size-7 rounded-md"
            >Mockmee
          </NuxtLink>
          <p class="text-sm max-w-xs">
            {{ t('pub.footerAbout') }}
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
            {{ t('pub.practise') }}
          </p>
          <ul class="flex flex-col gap-2 text-sm">
            <li>
              <NuxtLink
                to="/tests"
                class="hover:text-white"
              >{{ t('pub.allTests') }}</NuxtLink>
            </li>
            <li
              v-for="s in ['LISTENING', 'READING', 'WRITING', 'SPEAKING']"
              :key="s"
            >
              <NuxtLink
                :to="`/tests?skill=${s}`"
                class="hover:text-white"
              >{{ skillLabel(s) }}</NuxtLink>
            </li>
          </ul>
        </div>
        <div>
          <p class="text-sm font-semibold text-white mb-3">
            Mockmee
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
              >{{ t('pub.how') }}</NuxtLink>
            </li>
            <li>
              <NuxtLink
                to="/#faq"
                class="hover:text-white"
              >{{ t('pub.faq') }}</NuxtLink>
            </li>
          </ul>
        </div>
        <div>
          <p class="text-sm font-semibold text-white mb-3">
            {{ t('nav.account') }}
          </p>
          <ul class="flex flex-col gap-2 text-sm">
            <template v-if="loggedIn">
              <li>
                <NuxtLink
                  to="/results"
                  class="hover:text-white"
                >{{ t('nav.results') }}</NuxtLink>
              </li>
              <li>
                <NuxtLink
                  to="/profile"
                  class="hover:text-white"
                >{{ t('nav.profile') }}</NuxtLink>
              </li>
            </template>
            <li v-else>
              <NuxtLink
                :to="signInTo"
                class="hover:text-white"
              >{{ t('nav.signIn') }}</NuxtLink>
            </li>
            <li>
              <a
                :href="social.telegramUrl"
                target="_blank"
                rel="noopener"
                class="hover:text-white"
              >{{ t('pub.contact') }}</a>
            </li>
          </ul>
        </div>
      </div>
      <div class="border-t border-white/10">
        <p class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-5 text-xs text-white/50">
          © {{ year }} mockmee.uz
        </p>
      </div>
    </footer>
  </div>
</template>
