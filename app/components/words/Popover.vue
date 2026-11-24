<script setup lang="ts">
import type { SavedWord } from '~/utils/words'

/**
 * The card of a word just saved, beside the words selected in the text: "Saving…" while its
 * meaning is looked up, then the card. Clicking anywhere else closes it.
 */
const props = defineProps<{
  /** Where the selected words are on screen. */
  anchor: { left: number, right: number, top: number, bottom: number }
  word: SavedWord | null
  loading: boolean
  /** The selected words, shown while it is saving. */
  text: string
}>()
const emit = defineEmits<{ close: [], removed: [] }>()
const { t } = useI18n()
const saver = useWordSaver()
// Inside a test a link away would leave the paper; on a review page it is fine.
const route = useRoute()
const inTest = computed(() => route.path.startsWith('/tests/'))

const WIDTH = 320
const style = computed(() => {
  const vw = typeof window === 'undefined' ? 1024 : window.innerWidth
  const vh = typeof window === 'undefined' ? 768 : window.innerHeight
  const width = Math.min(WIDTH, vw - 24)
  const centre = (props.anchor.left + props.anchor.right) / 2
  const left = Math.min(Math.max(12, centre - width / 2), vw - width - 12)
  // Below the words, or above them when there is no room below.
  const below = props.anchor.bottom + 8
  return below + 220 > vh && props.anchor.top > 240
    ? { left: `${left}px`, bottom: `${vh - props.anchor.top + 8}px`, width: `${width}px` }
    : { left: `${left}px`, top: `${below}px`, width: `${width}px` }
})

async function remove() {
  if (props.word && await saver?.remove(props.word.id)) emit('removed')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[60]"
      @mousedown="emit('close')"
    />
    <div
      class="fixed z-[61] rounded-lg border border-default bg-default p-3 shadow-lg"
      :style="style"
      role="dialog"
      :aria-label="t('words.savedTitle')"
      data-testid="word-popover"
      @mousedown.stop
      @mouseup.stop
    >
      <div
        v-if="loading || !word"
        class="flex items-center gap-2 text-sm text-muted"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="animate-spin"
        />
        {{ t('words.saving', { word: text }) }}
      </div>
      <template v-else>
        <p class="text-xs text-muted mb-1 flex items-center gap-1">
          <UIcon name="i-lucide-book-check" />{{ t('words.addedToMyWords') }}
          <ULink
            v-if="saver?.mode.value === 'card' && !inTest"
            to="/words"
            class="ms-auto text-primary"
          >{{ t('words.open') }}</ULink>
        </p>
        <WordsCard
          :word="word"
          @remove="remove"
        />
      </template>
    </div>
  </Teleport>
</template>
