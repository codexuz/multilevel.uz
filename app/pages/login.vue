<script setup lang="ts">
definePageMeta({ layout: false })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const toast = useToast()
const loading = ref(false)

watchEffect(() => {
  if (user.value) navigateTo('/dashboard')
})

async function signInWithGoogle() {
  loading.value = true
  const redirectTo = `${window.location.origin}/confirm`
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo }
  })
  if (error) {
    loading.value = false
    toast.add({ title: 'Sign-in failed', description: error.message, color: 'error' })
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-elevated/30">
    <UCard class="w-full max-w-sm">
      <div class="flex flex-col items-center text-center gap-6 py-4">
        <div class="flex items-center gap-2 font-bold text-xl">
          <UIcon
            name="i-lucide-graduation-cap"
            class="size-7 text-primary"
          />
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

        <UButton
          block
          size="lg"
          color="neutral"
          variant="outline"
          icon="i-simple-icons-google"
          :loading="loading"
          label="Continue with Google"
          @click="signInWithGoogle"
        />

        <p class="text-xs text-muted">
          By continuing you agree to our terms of service.
        </p>
      </div>
    </UCard>
  </div>
</template>
