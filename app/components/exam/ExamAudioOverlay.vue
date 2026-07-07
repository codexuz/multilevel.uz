<script setup lang="ts">
// Full-screen overlay shown before the listening audio begins. Clicking Play
// starts playback (browsers require a user gesture to autoplay audio).
defineEmits<{ play: [] }>()
</script>

<template>
  <div class="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
    <div class="flex flex-col items-center gap-6 text-center max-w-md px-6">
      <div class="flex items-center justify-center size-24 rounded-full bg-white/10">
        <UIcon
          name="i-lucide-headphones"
          class="size-12 text-white"
        />
      </div>

      <div class="space-y-2">
        <p class="text-white text-lg italic leading-relaxed">
          Ushbu bo'limda audio tinglaysiz. Karnay yoki quloqchinlaringiz to'g'ri ishlayotganiga ishonch hosil qiling.
        </p>
        <p class="text-white/80">
          Davom etish uchun <strong>Play</strong> tugmasini bosing.
        </p>
      </div>

      <UButton
        color="error"
        size="xl"
        icon="i-lucide-play"
        label="Play"
        :ui="{ base: 'rounded-full px-10 font-semibold' }"
        @click="$emit('play')"
      />
    </div>
  </div>
</template>
