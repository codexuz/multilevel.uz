<script setup lang="ts">
/** How far along a word is: five steps, one for each review box it has climbed. */
const props = defineProps<{ box: number }>()
const { t } = useI18n()
const label = computed(() => (props.box <= 0 ? t('words.stageNew') : props.box >= TOP_WORD_BOX ? t('words.stageKnown') : t('words.stageLearning', { n: props.box, of: TOP_WORD_BOX })))
</script>

<template>
  <span
    class="inline-flex items-center gap-0.5"
    role="img"
    :aria-label="label"
    :title="label"
  >
    <span
      v-for="i in TOP_WORD_BOX"
      :key="i"
      class="size-1.5 rounded-full"
      :class="i <= box ? (box >= TOP_WORD_BOX ? 'bg-success' : 'bg-primary') : 'bg-accented'"
    />
  </span>
</template>
