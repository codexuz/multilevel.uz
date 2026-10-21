<script setup lang="ts">
// Signing in, in the manner of SmallTalk2Me's sign-up card: the logo, a big title with a 3D
// illustration, Google or Telegram (whichever are set up). Signing in is optional: tests are open to everyone; an account
// keeps the results and sends Writing and Speaking to an examiner.
definePageMeta({ layout: false })

const route = useRoute()
const oauthError = computed(() => route.query.error === 'oauth')
const next = computed(() => (typeof route.query.next === 'string' && route.query.next.startsWith('/') && !route.query.next.startsWith('//') ? route.query.next : '/tests'))

/** Where to come back to after signing in: kept for a few minutes, read once by the sign-in route. */
function rememberNext() {
  document.cookie = `ml_next=${encodeURIComponent(next.value)}; path=/; max-age=600; samesite=lax`
}

const telegram = useTelegramLogin()
// The way this device signed in before: Google and Telegram make separate accounts until they are
// connected, so the same button matters.
const last = ref<'google' | 'telegram' | null>(null)
onMounted(() => (last.value = lastSignIn()))
function signInWithGoogle() {
  rememberNext()
  rememberSignIn('google')
}
const showGoogle = computed(() => telegram.providers.value?.google !== false)
async function signInWithTelegram() {
  rememberNext()
  const done = await telegram.start()
  // A full load, so the whole app starts again signed in.
  if (done) window.location.assign(done.to)
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

      <UAlert
        v-if="telegram.error.value"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :description="telegram.error.value"
        class="mt-5"
      />

      <div class="mt-6 flex flex-col gap-2.5">
        <UButton
          v-if="showGoogle"
          block
          size="xl"
          color="neutral"
          variant="soft"
          icon="i-logos-google-icon"
          label="Continue with Google"
          to="/auth/google"
          external
          class="font-semibold"
          @click="signInWithGoogle"
        >
          <template
            v-if="last === 'google'"
            #trailing
          >
            <UBadge
              label="Last used"
              color="primary"
              variant="subtle"
              size="sm"
            />
          </template>
        </UButton>
        <UButton
          v-if="telegram.available.value"
          block
          size="xl"
          color="neutral"
          variant="soft"
          icon="i-logos-telegram"
          label="Continue with Telegram"
          :loading="telegram.busy.value"
          class="font-semibold"
          @click="signInWithTelegram"
        >
          <template
            v-if="last === 'telegram'"
            #trailing
          >
            <UBadge
              label="Last used"
              color="primary"
              variant="subtle"
              size="sm"
            />
          </template>
        </UButton>
      </div>
      <p
        v-if="showGoogle && telegram.available.value"
        class="mt-3 text-xs text-muted text-pretty"
      >
        Signed up before? Use the same button as last time: Google and Telegram make separate accounts until you connect them on your Profile.
      </p>

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
      By signing in you agree to keep to fair use of the tests. We only use the name, email or Telegram username, and picture you sign in with.
    </p>
  </UMain>
</template>
