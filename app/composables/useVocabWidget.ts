export type TilmochLang = 'eng_Latn' | 'uzn_Latn' | 'rus_Cyrl'

export interface VocabLookupEntry {
  text: string
  translated: string
  sourceLang: TilmochLang
  targetLang: TilmochLang
}

const ENABLED_KEY = 'ml_vocab_widget_enabled'
const PAIR_KEY = 'ml_vocab_widget_pair'
const HISTORY_KEY = 'ml_vocab_widget_history'
const MAX_HISTORY = 8

/**
 * Shared state and preferences for the floating Tilmoch vocabulary widget:
 * - Persisted on/off toggle (controlled from Settings or the widget itself)
 * - Automatic exclusion on all exam, seat, live mock, game, and active quiz pages
 * - Persisted language pair and recent lookups
 */
export function useVocabWidget() {
  const route = useRoute()
  const enabled = useState<boolean>('vocab-widget-enabled', () => true)
  const initialized = useState<boolean>('vocab-widget-init', () => false)
  const sourceLang = useState<TilmochLang>('vocab-widget-src', () => 'eng_Latn')
  const targetLang = useState<TilmochLang>('vocab-widget-tgt', () => 'uzn_Latn')
  const history = useState<VocabLookupEntry[]>('vocab-widget-history', () => [])

  if (import.meta.client && !initialized.value) {
    initialized.value = true
    try {
      const saved = localStorage.getItem(ENABLED_KEY)
      if (saved === '0' || saved === 'false') enabled.value = false
      else if (saved === '1' || saved === 'true') enabled.value = true

      const pairRaw = localStorage.getItem(PAIR_KEY)
      if (pairRaw) {
        const pair = JSON.parse(pairRaw) as { s?: TilmochLang, t?: TilmochLang }
        if (pair.s && ['eng_Latn', 'uzn_Latn', 'rus_Cyrl'].includes(pair.s)) sourceLang.value = pair.s
        if (pair.t && ['eng_Latn', 'uzn_Latn', 'rus_Cyrl'].includes(pair.t)) targetLang.value = pair.t
      }

      const histRaw = localStorage.getItem(HISTORY_KEY)
      if (histRaw) {
        const parsed = JSON.parse(histRaw)
        if (Array.isArray(parsed)) history.value = parsed.slice(0, MAX_HISTORY)
      }
    } catch {
      // Ignore storage access errors in private browsing modes.
    }
  }

  function setEnabled(val: boolean) {
    enabled.value = val
    if (import.meta.client) {
      try {
        localStorage.setItem(ENABLED_KEY, val ? '1' : '0')
      } catch {}
    }
  }

  function setLangPair(src: TilmochLang, tgt: TilmochLang) {
    sourceLang.value = src
    targetLang.value = tgt
    if (import.meta.client) {
      try {
        localStorage.setItem(PAIR_KEY, JSON.stringify({ s: src, t: tgt }))
      } catch {}
    }
  }

  function swapLangs() {
    setLangPair(targetLang.value, sourceLang.value)
  }

  function pushHistory(entry: VocabLookupEntry) {
    const next = [
      entry,
      ...history.value.filter(
        h => !(h.text.toLowerCase() === entry.text.toLowerCase() && h.sourceLang === entry.sourceLang && h.targetLang === entry.targetLang)
      )
    ].slice(0, MAX_HISTORY)
    history.value = next
    if (import.meta.client) {
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      } catch {}
    }
  }

  function clearHistory() {
    history.value = []
    if (import.meta.client) {
      try {
        localStorage.removeItem(HISTORY_KEY)
      } catch {}
    }
  }

  /** True on any exam, test-sitting, seat, live mock room, word game, or active quiz page. */
  const isExamPage = computed(() => {
    const layout = route.meta.layout
    if (layout === 'exam' || layout === 'game') return true
    const p = route.path
    if (p === '/seat' || p.startsWith('/seat/')) return true
    if (/^\/(reading|listening|writing)\/[^/]+/.test(p)) return true
    if (/^\/tests\/[^/]+\/(reading|listening|writing|speaking)(\/|$)/.test(p)) return true
    if (/^\/mocks\/[^/]+/.test(p)) return true
    if (/^\/courses\/[^/]+\/[^/]+\/quizzes\/[^/]+$/.test(p)) return true
    return false
  })

  const visible = computed(() => enabled.value && !isExamPage.value)

  return {
    enabled,
    sourceLang,
    targetLang,
    history,
    isExamPage,
    visible,
    setEnabled,
    setLangPair,
    swapLangs,
    pushHistory,
    clearHistory
  }
}
