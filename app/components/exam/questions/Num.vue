<script setup lang="ts">
defineProps<{ n: number | string }>()
</script>

<template>
  <UBadge
    :label="String(n)"
    color="error"
    variant="soft"
    class="rounded-full min-w-7 h-7 px-1.5 justify-center font-bold shrink-0"
  />
</template>
