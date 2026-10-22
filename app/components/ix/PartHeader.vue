<script setup lang="ts">
defineProps<{ label: string, instruction?: string }>()
</script>

<template>
  <section class="ix-rubric" data-testid="rubric">
    <h2>
      {{ label }}
      <slot name="badges" />
    </h2>
    <p v-if="instruction">
      {{ instruction }}
    </p>
  </section>
</template>
