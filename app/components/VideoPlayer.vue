<script setup lang="ts">
// Renders a video source that may be a direct file URL or a YouTube link.
const props = defineProps<{ src?: string | null }>()

const embed = computed(() => youtubeEmbedUrl(props.src))
</script>

<template>
  <div
    v-if="src"
    class="w-full"
  >
    <iframe
      v-if="embed"
      :src="embed"
      class="aspect-video w-full rounded-lg border border-default bg-black"
      title="Video"
      loading="lazy"
      referrerpolicy="strict-origin-when-cross-origin"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
    />
    <video
      v-else
      :src="src"
      controls
      class="w-full rounded-lg border border-default bg-black"
    />
  </div>
</template>
