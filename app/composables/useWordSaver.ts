import type { InjectionKey, MaybeRefOrGetter } from 'vue'
import type { SavedWord } from '~/utils/words'

/**
 * Saving words to My Words from a text a student reads. A page says how: `card` (the review, a
 * part practised on its own) shows what the word means at once; `quiet` (a whole timed section)
 * only keeps it, and the result page shows the words afterwards, so the test stays like the real
 * one. Text panels under the page offer Save word when the student is signed in.
 */
export type WordSaveMode = 'quiet' | 'card'

export interface WordSaver {
  mode: ComputedRef<WordSaveMode>
  enabled: ComputedRef<boolean>
  /** Saves the words; in card mode resolves to the saved word (with its meaning), else to null. */
  save: (word: string, sentence: string, partId?: string | null) => Promise<SavedWord | null>
  remove: (id: string) => Promise<boolean>
}

const KEY: InjectionKey<WordSaver> = Symbol('word-saver')

export function provideWordSaver(opts: { mode: MaybeRefOrGetter<WordSaveMode>, enabled?: MaybeRefOrGetter<boolean> }) {
  const { loggedIn } = useMe()
  const { t, locale } = useI18n()
  const toast = useToast()
  const mode = computed(() => toValue(opts.mode))
  const enabled = computed(() => loggedIn.value && (opts.enabled === undefined || toValue(opts.enabled)))

  async function save(word: string, sentence: string, partId?: string | null) {
    const request = $fetch<{ word: SavedWord, created: boolean }>('/api/me/words', {
      method: 'POST',
      body: { word, sentence, partId: partId ?? null, locale: locale.value }
    })
    if (mode.value === 'quiet') {
      toast.add({ title: t('words.savedQuiet', { word }), icon: 'i-lucide-book-check', duration: 1800 })
      request.catch((e: any) => toast.add({ title: t('words.notSaved'), description: e?.data?.message, color: 'error' }))
      return null
    }
    try {
      return (await request).word
    } catch (e: any) {
      toast.add({ title: t('words.notSaved'), description: e?.data?.message || e?.message, color: 'error' })
      return null
    }
  }

  async function remove(id: string) {
    try {
      await $fetch(`/api/me/words/${id}`, { method: 'DELETE' })
      return true
    } catch (e: any) {
      toast.add({ title: t('words.notRemoved'), description: e?.data?.message, color: 'error' })
      return false
    }
  }

  const saver: WordSaver = { mode, enabled, save, remove }
  provide(KEY, saver)
  return saver
}

export function useWordSaver() {
  return inject(KEY, null)
}

/**
 * Saving the words selected in a text panel: in card mode the panel shows the card (WordsPopover)
 * from `card`. `canSave(range)` says whether the selection can be saved at all.
 */
export function useWordPick() {
  const saver = useWordSaver()
  const card = ref<{ anchor: { left: number, right: number, top: number, bottom: number }, text: string, word: SavedWord | null, loading: boolean } | null>(null)
  const available = computed(() => !!saver?.enabled.value)

  const canSave = (range: Range | null) => available.value && !!selectedWord(range)

  async function saveRange(range: Range | null, partId?: string | null) {
    const picked = selectedWord(range)
    if (!saver || !range || !picked) return
    const r = range.getBoundingClientRect()
    window.getSelection()?.removeAllRanges()
    if (saver.mode.value === 'quiet') {
      saver.save(picked.word, picked.sentence, partId)
      return
    }
    const shown = { anchor: { left: r.left, right: r.right, top: r.top, bottom: r.bottom }, text: picked.word, word: null, loading: true }
    card.value = shown
    const word = await saver.save(picked.word, picked.sentence, partId)
    // Closed, or another word picked, meanwhile.
    if (card.value?.text !== shown.text) return
    if (!word) card.value = null
    else card.value = { ...card.value, word, loading: false }
  }

  return { card, available, canSave, saveRange, close: () => (card.value = null) }
}
