<script setup lang="ts">
withDefaults(defineProps<{ collapsed?: boolean, to?: string }>(), { to: '/' })
</script>

<template>
  <ULink
    :to="to"
    class="flex items-center gap-2 font-semibold text-highlighted"
  >
    <UAvatar
      src="/icon.svg"
      alt="Mockmee"
      size="sm"
      :ui="{ root: 'bg-transparent rounded-md', image: 'object-contain' }"
    />
    <span
      v-if="!collapsed"
      class="text-lg tracking-tight"
    >Mockmee</span>
  </ULink>
</template>
