<script setup lang="ts">
const theme = provideExamTheme()
</script>

<template>
  <div
    class="exam-surface h-dvh min-w-0 flex flex-col bg-muted text-default"
    :style="theme.style.value"
  >
    <slot />
  </div>
</template>
