<script setup lang="ts">
import type { Attachment } from '~/types/community'

const props = defineProps<{ attachments: Attachment[] }>()

const images = computed(() => props.attachments.filter(a => a.type === 'image'))
const audios = computed(() => props.attachments.filter(a => a.type === 'audio'))

// Lightbox: index into `images`, or null when closed.
const active = ref<number | null>(null)
const open = computed({
  get: () => active.value !== null,
  set: (value: boolean) => {
    if (!value) active.value = null
  }
})
const activeImage = computed(() => (active.value === null ? null : images.value[active.value] ?? null))

function show(index: number) {
  active.value = index
}
function close() {
  active.value = null
}
function step(delta: number) {
  if (active.value === null || images.value.length < 2) return
  const count = images.value.length
  active.value = (active.value + delta + count) % count
}
</script>

<template>
  <div
    v-if="attachments.length"
    class="space-y-3"
  >
    <!-- A lone image needs no carousel chrome. -->
    <button
      v-if="images.length === 1"
      type="button"
      class="block w-full overflow-hidden rounded-lg border border-default bg-elevated/30"
      aria-label="Open image"
      @click="show(0)"
    >
      <img
        :src="images[0]!.url"
        alt="Attachment"
        loading="lazy"
        class="w-full max-h-[32rem] object-contain"
      >
    </button>

    <UCarousel
      v-else-if="images.length > 1"
      v-slot="{ item, index }"
      :items="images"
      arrows
      dots
      class="w-full"
      :ui="{ item: 'basis-full' }"
    >
      <button
        type="button"
        class="block w-full overflow-hidden rounded-lg border border-default bg-elevated/30"
        aria-label="Open image"
        @click="show(index)"
      >
        <img
          :src="item.url"
          alt="Attachment"
          loading="lazy"
          class="w-full max-h-[32rem] object-contain"
        >
      </button>
    </UCarousel>

    <WaveAudioPlayer
      v-for="audio in audios"
      :key="audio.url"
      :src="audio.url"
    />

    <UModal
      v-model:open="open"
      :ui="{ content: 'max-w-5xl' }"
    >
      <template #content>
        <div class="relative bg-default">
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            class="absolute right-2 top-2 z-10"
            aria-label="Close"
            @click="close"
          />

          <template v-if="images.length > 1">
            <UButton
              icon="i-lucide-chevron-left"
              color="neutral"
              variant="solid"
              class="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full"
              aria-label="Previous image"
              @click="step(-1)"
            />
            <UButton
              icon="i-lucide-chevron-right"
              color="neutral"
              variant="solid"
              class="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full"
              aria-label="Next image"
              @click="step(1)"
            />
          </template>

          <img
            v-if="activeImage"
            :src="activeImage.url"
            alt="Attachment"
            class="max-h-[85vh] w-full object-contain"
          >

          <p
            v-if="images.length > 1"
            class="absolute inset-x-0 bottom-2 text-center text-xs text-muted"
          >
            {{ (active ?? 0) + 1 }} / {{ images.length }}
          </p>
        </div>
      </template>
    </UModal>
  </div>
</template>
