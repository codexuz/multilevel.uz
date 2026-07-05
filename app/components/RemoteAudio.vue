<script setup lang="ts">
const props = defineProps<{ stream: MediaStream }>()
const el = ref<HTMLAudioElement | null>(null)

watchEffect(() => {
  if (el.value && props.stream) el.value.srcObject = props.stream
})
</script>

<template>
  <audio ref="el" autoplay class="hidden" />
</template>
