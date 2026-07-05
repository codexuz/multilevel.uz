<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const oauthError = computed(() => route.query.error === 'oauth')
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-elevated/30">
    <UCard class="w-full max-w-sm">
      <div class="flex flex-col items-center text-center gap-6 py-4">
        <div class="flex items-center gap-2 font-bold text-xl">
          <UIcon name="i-lucide-graduation-cap" class="size-7 text-primary" />
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
