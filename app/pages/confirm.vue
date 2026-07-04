<script setup lang="ts">
definePageMeta({ layout: false })

// OAuth callback landing. @nuxtjs/supabase handles the session exchange;
// once the user is present we redirect into the app.
const user = useSupabaseUser()

watchEffect(() => {
  if (user.value) navigateTo('/dashboard')
})

// Fallback if the session never resolves.
onMounted(() => {
  setTimeout(() => {
    if (!user.value) navigateTo('/login')
  }, 8000)
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="flex flex-col items-center gap-4 text-muted">
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 animate-spin text-primary"
      />
      <p>Signing you in…</p>
    </div>
  </div>
</template>
