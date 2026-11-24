<script setup lang="ts">
import type { SavedWord } from '~/utils/words'

/** A saved word: what it means, in the student's language too, the sentence it came from, and a voice. */
const props = defineProps<{ word: SavedWord, compact?: boolean }>()
const emit = defineEmits<{ remove: [] }>()
const { t } = useI18n()

const head = computed(() => props.word.lemma && props.word.lemma !== props.word.term ? props.word.lemma : props.word.word)
const parts = computed(() => (props.word.sentence ? splitSentence(props.word.sentence, props.word.word) : null))
const canSpeak = ref(false)
onMounted(() => (canSpeak.value = 'speechSynthesis' in window))
</script>

<template>
  <div
    class="flex flex-col gap-2 text-default"
    data-testid="word-card"
  >
    <div class="flex items-center gap-2">
      <span class="text-lg font-semibold text-highlighted">{{ head }}</span>
      <span
        v-if="word.partOfSpeech"
        class="text-sm italic text-muted"
      >{{ word.partOfSpeech }}</span>
      <UBadge
        v-if="word.cefr"
        :label="word.cefr"
        color="neutral"
        variant="subtle"
        size="sm"
      />
      <UButton
        v-if="canSpeak"
        icon="i-lucide-volume-2"
        color="neutral"
        variant="ghost"
        size="sm"
        class="ms-auto"
        :aria-label="t('words.listen')"
        @click="speakWord(head)"
      />
    </div>
    <p
      v-if="word.definition"
      class="text-sm leading-6"
    >
      {{ word.definition }}
    </p>
    <p
      v-else
      class="text-sm text-muted"
    >
      {{ t('words.noMeaning') }}
    </p>
    <p
      v-if="word.translation"
      class="text-sm font-medium text-primary"
    >
      {{ word.translation }}
    </p>
    <p
      v-if="parts && !compact"
      class="text-sm text-toned border-s-2 border-default ps-2 leading-6"
    >
      {{ parts[0] }}<strong class="text-highlighted">{{ parts[1] }}</strong>{{ parts[2] }}
    </p>
    <div class="flex justify-end">
      <UButton
        :label="t('words.remove')"
        icon="i-lucide-trash-2"
        color="neutral"
        variant="ghost"
        size="xs"
        @click="emit('remove')"
      />
    </div>
  </div>
</template>
