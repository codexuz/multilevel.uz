<script setup lang="ts">
defineProps<{ loading: boolean, error?: string | null, backTo?: string, backLabel?: string }>()
const router = useRouter()
</script>

<template>
  <div
    v-if="loading"
    class="h-dvh flex items-center justify-center bg-muted"
  >
    <UIcon
      name="i-lucide-loader-circle"
      class="size-10 animate-spin text-primary"
    />
  </div>
  <div
    v-else-if="error"
    class="h-dvh flex items-center justify-center bg-muted p-4"
  >
    <UEmpty
      icon="i-lucide-circle-alert"
      :title="error"
      :actions="[{ label: backLabel || 'Go back', icon: 'i-lucide-arrow-left', variant: 'outline', onClick: () => { if (backTo) router.push(backTo); else router.back() } }]"
    />
  </div>
  <slot v-else />
</template>
