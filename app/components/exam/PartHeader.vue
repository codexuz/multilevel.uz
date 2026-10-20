<script setup lang="ts">
defineProps<{ label: string, instruction?: string }>()
</script>

<template>
  <div class="shrink-0 px-4 py-3 border-b border-default bg-muted">
    <div class="flex items-center gap-2">
      <p class="text-sm font-bold text-highlighted">
        {{ label }}
      </p>
      <slot name="badges" />
    </div>
    <p
      v-if="instruction"
      class="text-sm text-muted"
    >
      {{ instruction }}
    </p>
  </div>
</template>
