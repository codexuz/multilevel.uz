<script setup lang="ts">
/**
 * Onboarding's own page, outside the app (no sidebar or menus), as learning apps do it: the logo,
 * the language, a way out, and the steps in the middle of a soft background.
 */
const { t } = useI18n()
const { confirm } = useDialogs()
async function logout() {
  if (!await confirm({ title: t('profile.logOutSure'), description: t('profile.logOutText'), confirmLabel: t('nav.logOut'), color: 'error' })) return
  await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  reloadNuxtApp({ path: '/' })
}
</script>

<template>
  <div class="min-h-dvh flex flex-col bg-linear-to-b from-primary/8 via-default to-default">
    <header class="mx-auto w-full max-w-5xl h-16 px-4 sm:px-6 flex items-center gap-3">
      <AppLogo to="/" />
      <div class="ms-auto flex items-center gap-1">
        <LanguageSwitcher />
        <UButton
          :label="t('nav.logOut')"
          icon="i-lucide-log-out"
          color="neutral"
          variant="ghost"
          size="sm"
          class="max-sm:hidden"
          @click="logout"
        />
      </div>
    </header>
    <main class="flex-1 flex flex-col">
      <slot />
    </main>
  </div>
</template>
