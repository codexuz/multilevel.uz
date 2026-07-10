<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const oauthError = computed(() => route.query.error === 'oauth')

useSeoMeta({
  title: 'Sign in',
  description: 'Sign in to continue practicing Multilevel English mock exams.'
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-elevated/30">
    <UCard class="w-full max-w-sm">
      <div class="flex flex-col items-center text-center gap-6 py-4">
        <div class="flex items-center gap-2 font-bold text-xl">
          <img src="/logo.png" alt="" class="size-7 object-contain">
          <span>Multilevel</span>
        </div>
        <div>
          <h1 class="text-lg font-semibold">
            Sign in to continue
          </h1>
          <p class="text-sm text-muted mt-1">
            Practice full Multilevel English mock exams.
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
        />

        <p class="text-xs text-muted">
          By continuing you agree to our terms of service.
        </p>
      </div>
    </UCard>
  </div>
</template>
