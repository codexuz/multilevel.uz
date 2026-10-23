/**
 * What the exam page sees while a section is sat, sent with the hand-in for integrity.ts to weigh:
 * leaving the page (another tab or app; on a computer, another window for more than a few
 * seconds), leaving full screen, and pasting into an answer. Kept with the paper in this browser so
 * a reload keeps it. The first time the candidate comes back from elsewhere a note says it is seen.
 * Nothing is blocked: an admin looks at what stands out.
 */
export interface IntegritySignals { away: number, awaySeconds: number, fullscreenExits: number, pastes: number, pastedChars: number }

const empty = (): IntegritySignals => ({ away: 0, awaySeconds: 0, fullscreenExits: 0, pastes: 0, pastedChars: 0 })
/** Another window this long is leaving the page (shorter is a click on the taskbar, a notification…). */
const BLUR_MS = 3000

export function useIntegrity(storageKey: string, opts: { active: () => boolean, countBlur?: boolean }) {
  const { t } = useI18n()
  const toast = useToast()
  const signals = reactive<IntegritySignals>(empty())
  const key = `${storageKey}.integrity`
  let noticed = false

  const save = () => {
    try { localStorage.setItem(key, JSON.stringify(signals)) } catch {}
  }
  function cameBack(ms: number) {
    signals.away++
    signals.awaySeconds += Math.round(ms / 1000)
    save()
    if (!noticed) {
      noticed = true
      toast.add({ title: t('integrity.noticedTitle'), description: t('integrity.noticedText'), icon: 'i-lucide-eye', color: 'warning' })
    }
  }

  let hiddenAt: number | null = null
  let blurAt: number | null = null
  function onVisibility() {
    if (!opts.active()) return
    if (document.hidden) {
      hiddenAt = Date.now()
      blurAt = null
    } else if (hiddenAt != null) {
      cameBack(Date.now() - hiddenAt)
      hiddenAt = null
    }
  }
  function onBlur() {
    if (opts.active() && opts.countBlur !== false && !document.hidden) blurAt = Date.now()
  }
  function onFocus() {
    if (blurAt != null && hiddenAt == null && Date.now() - blurAt >= BLUR_MS) cameBack(Date.now() - blurAt)
    blurAt = null
  }
  let wasFullscreen = false
  function onFullscreen() {
    const now = !!document.fullscreenElement
    if (wasFullscreen && !now && opts.active()) {
      signals.fullscreenExits++
      save()
    }
    wasFullscreen = now
  }
  function onPaste(e: ClipboardEvent) {
    const target = e.target as HTMLElement | null
    if (!opts.active() || !target?.closest('textarea, input, [contenteditable]')) return
    signals.pastes++
    signals.pastedChars += (e.clipboardData?.getData('text') ?? '').length
    save()
  }

  onMounted(() => {
    try { Object.assign(signals, empty(), JSON.parse(localStorage.getItem(key) ?? 'null') ?? {}) } catch {}
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    document.addEventListener('fullscreenchange', onFullscreen)
    document.addEventListener('paste', onPaste, true)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('blur', onBlur)
    window.removeEventListener('focus', onFocus)
    document.removeEventListener('fullscreenchange', onFullscreen)
    document.removeEventListener('paste', onPaste, true)
  })

  /** A fresh start (the paper sat again): nothing seen yet. */
  function reset() {
    Object.assign(signals, empty())
    try { localStorage.removeItem(key) } catch {}
  }
  return { signals, reset }
}
