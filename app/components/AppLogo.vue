<script setup lang="ts">
defineProps<{ collapsed?: boolean }>()
</script>

<template>
  <ULink
    to="/"
    class="flex items-center gap-2 font-semibold text-highlighted"
  >
    <UAvatar
      src="/logo.png"
      alt="Multilevel"
      size="sm"
      :ui="{ root: 'bg-transparent rounded-md', image: 'object-contain' }"
    />
    <span
      v-if="!collapsed"
      class="text-lg tracking-tight"
    >Multilevel</span>
  </ULink>
</template>
