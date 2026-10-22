<script setup lang="ts">
/**
 * The dark cover over the test before it begins: for Listening the headphones and Play (the
 * recording plays once and cannot be paused), for Reading and Writing what the section is and Start.
 */
defineProps<{ listening?: boolean, text?: string }>()
const emit = defineEmits<{ go: [] }>()
</script>

<template>
  <div class="ix-cover" role="dialog" aria-modal="true" data-testid="start-cover">
    <UIcon :name="listening ? 'i-lucide-headphones' : 'i-lucide-book-open-text'" class="is-big" />
    <p v-if="listening">
      You will be listening to an audio clip during this test. You will not be permitted to pause or rewind the audio while answering the questions.
    </p>
    <p v-else>
      {{ text }}
    </p>
    <p>To continue, click {{ listening ? 'Play' : 'Start' }}.</p>
    <button type="button" class="ix-black-btn" :data-testid="listening ? 'play' : 'start'" autofocus @click="emit('go')">
      <UIcon :name="listening ? 'i-lucide-circle-play' : 'i-lucide-arrow-right'" />{{ listening ? 'Play' : 'Start' }}
    </button>
  </div>
</template>
