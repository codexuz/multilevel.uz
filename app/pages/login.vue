<script setup lang="ts">
// The erp-lms IELTS app's sign-in card (layouts/auth.vue there). Signing in is optional: tests are
// open to everyone, an account keeps the results and sends Writing and Speaking to an examiner.
definePageMeta({ layout: false })

const route = useRoute()
const oauthError = computed(() => route.query.error === 'oauth')
const next = computed(() => (typeof route.query.next === 'string' && route.query.next.startsWith('/') && !route.query.next.startsWith('//') ? route.query.next : '/tests'))

/** Where to come back to after Google: kept for a few minutes, read once by the sign-in route. */
function rememberNext() {
  document.cookie = `ml_next=${encodeURIComponent(next.value)}; path=/; max-age=600; samesite=lax`
}

useSeoMeta({
  title: 'Sign in',
  description: 'Sign in to keep your Multilevel practice results and have your Writing and Speaking marked by an examiner.',
  robots: 'noindex'
})
</script>

<template>
  <UMain class="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-br from-primary-50 via-default to-default dark:from-primary-950/40">
    <UPageCard class="w-full max-w-sm">
      <div class="flex flex-col items-center text-center gap-6 py-2">
        <AppLogo />
        <div>
          <h1 class="text-lg font-semibold text-highlighted">
            Sign in to keep your results
          </h1>
          <p class="text-sm text-muted mt-1">
            Every test is free without an account. Signing in saves your scores and sends your Writing and Speaking to an examiner.
          </p>
        </div>

        <UAlert
          v-if="oauthError"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          description="Sign-in failed. Please try again."
        />

        <UButton
          block
          size="lg"
          color="neutral"
          variant="outline"
          icon="i-simple-icons-google"
          label="Continue with Google"
          to="/auth/google"
          external
          @click="rememberNext"
        />

        <UButton
          :to="next"
          variant="link"
          color="neutral"
          label="Continue without an account"
        />
      </div>
    </UPageCard>
  </UMain>
</template>
