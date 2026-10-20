<script setup lang="ts">
// Signing in, in the manner of SmallTalk2Me's sign-up card: the logo, a big title with a 3D
// illustration, one clear way in. Signing in is optional: tests are open to everyone; an account
// keeps the results and sends Writing and Speaking to an examiner.
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

const perks = ['Keep every result and see your best', 'Writing and Speaking marked by an examiner', 'Pick up a test where you left it']
</script>

<template>
  <UMain class="min-h-dvh flex flex-col items-center px-4 pt-8 pb-10 sm:justify-center bg-default">
    <AppLogo class="mb-6" />
    <div class="w-full max-w-md rounded-xl ring ring-default bg-default p-6 sm:p-8">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-3xl sm:text-4xl font-bold text-highlighted">
            Sign in
          </h1>
          <p class="text-sm text-muted mt-2">
            Every test is free without an account. Sign in to keep what you do.
          </p>
        </div>
        <img
          src="/illustrations/rocket.svg"
          alt=""
          class="size-20 sm:size-24 shrink-0 -mt-2 -me-2 drop-shadow-xl"
          aria-hidden="true"
        >
      </div>

      <UAlert
        v-if="oauthError"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        description="Sign-in failed. Please try again."
        class="mt-5"
      />

      <UButton
        block
        size="xl"
        color="neutral"
        variant="soft"
        icon="i-logos-google-icon"
        label="Continue with Google"
        to="/auth/google"
        external
        class="mt-6 font-semibold"
        @click="rememberNext"
      />

      <ul class="mt-6 flex flex-col gap-2.5">
        <li
          v-for="p in perks"
          :key="p"
          class="flex items-center gap-2.5 text-sm text-toned"
        >
          <UIcon
            name="i-lucide-circle-check"
            class="size-5 text-success shrink-0"
          />{{ p }}
        </li>
      </ul>

      <USeparator
        label="or"
        class="my-6"
      />

      <UButton
        :to="next"
        block
        size="lg"
        color="neutral"
        variant="outline"
        label="Continue without an account"
      />
    </div>
    <p class="mt-6 text-xs text-muted text-center max-w-sm">
      By signing in you agree to keep to fair use of the tests. We only use your Google name, email and picture.
    </p>
  </UMain>
</template>
