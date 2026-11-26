<script setup lang="ts">
import type { SavedWord } from '~/utils/words'

/** A saved word in the My Words list: open it for the sentence it came from. */
const props = defineProps<{ word: SavedWord }>()
const emit = defineEmits<{ remove: [] }>()
const { t } = useI18n()

const open = ref(false)
const head = computed(() => props.word.lemma && props.word.lemma !== props.word.term ? props.word.lemma : props.word.word)
const parts = computed(() => (props.word.sentence ? splitSentence(props.word.sentence, props.word.word) : null))
const due = computed(() => wordDueLabel(props.word.dueAt, t))
const canSpeak = ref(false)
onMounted(() => (canSpeak.value = canSpeakWords()))
</script>

<template>
  <div
    class="px-3 sm:px-4 py-2.5 sm:py-3"
    data-testid="word-row"
  >
    <div class="flex items-start gap-3">
      <button
        type="button"
        class="min-w-0 flex-1 text-start"
        :aria-expanded="open"
        @click="open = !open"
      >
        <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span class="font-semibold text-highlighted">{{ head }}</span>
          <span
            v-if="word.partOfSpeech"
            class="text-xs italic text-muted max-sm:hidden"
          >{{ word.partOfSpeech }}</span>
          <UBadge
            v-if="word.cefr"
            :label="word.cefr"
            color="neutral"
            variant="subtle"
            size="sm"
            class="max-sm:hidden"
          />
          <span
            v-if="word.translation"
            class="text-sm text-primary"
          >{{ word.translation }}</span>
        </span>
        <span
          class="block text-sm text-toned mt-0.5"
          :class="{ 'line-clamp-1': !open }"
        >
          {{ word.definition || t('words.noMeaning') }}
        </span>
      </button>
      <div class="flex flex-col items-end gap-1 shrink-0">
        <WordsProgress :box="word.box" />
        <span
          class="text-xs max-sm:hidden"
          :class="due.now ? 'text-warning font-medium' : 'text-muted'"
        >{{ due.label }}</span>
      </div>
    </div>
    <div
      v-if="open"
      class="mt-2 flex flex-col gap-2"
    >
      <p
        v-if="parts"
        class="text-sm text-toned border-s-2 border-default ps-2 leading-6"
      >
        {{ parts[0] }}<strong class="text-highlighted">{{ parts[1] }}</strong>{{ parts[2] }}
      </p>
      <div class="icons-sm flex items-center gap-1">
        <UButton
          v-if="canSpeak"
          :label="t('words.listen')"
          icon="i-lucide-volume-2"
          color="neutral"
          variant="ghost"
          size="xs"
          @click="speakWord(head)"
        />
        <UButton
          :label="t('words.remove')"
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          size="xs"
          class="ms-auto"
          @click="emit('remove')"
        />
      </div>
    </div>
  </div>
</template>
