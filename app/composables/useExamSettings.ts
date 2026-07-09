export type ExamContrast = 'default' | 'black-on-white' | 'white-on-black' | 'yellow-on-black'

export interface ExamSettings {
  scale: number
  contrast: ExamContrast
}

export const CONTRAST_OPTIONS: { value: ExamContrast, label: string, bg: string, fg: string }[] = [
  { value: 'default', label: 'Standart', bg: 'var(--ui-bg)', fg: 'var(--ui-text)' },
  { value: 'black-on-white', label: 'Oq fonda qora', bg: '#ffffff', fg: '#111827' },
  { value: 'white-on-black', label: 'Qora fonda oq', bg: '#111111', fg: '#e5e7eb' },
  { value: 'yellow-on-black', label: 'Qora fonda sariq', bg: '#111111', fg: '#f6c543' }
]

/** Font scale steps, as a multiplier of the 16px root size. */
const SCALES = [0.85, 1, 1.15, 1.3, 1.5]
const BASE_FONT_PX = 16
const STORAGE_KEY = 'exam-settings'

/**
 * Reading comfort settings for the exam runner: text size and contrast mode.
 * Shared across the page and the settings modal, persisted in localStorage.
 *
 * Text size works by scaling the root font size — Tailwind's `text-*` utilities
 * are rem-based, so every size in the runner scales with it. The exam is a
 * full-screen page, so nothing outside it is affected while it's open.
 */
export function useExamSettings() {
  const settings = useState<ExamSettings>('exam-settings', () => ({ scale: 1, contrast: 'default' }))

  const scaleIndex = computed(() => {
    const i = SCALES.indexOf(settings.value.scale)
    return i === -1 ? 1 : i
  })
  const canIncrease = computed(() => scaleIndex.value < SCALES.length - 1)
  const canDecrease = computed(() => scaleIndex.value > 0)
  const scalePercent = computed(() => Math.round(settings.value.scale * 100))

  function increase() {
    if (canIncrease.value) settings.value.scale = SCALES[scaleIndex.value + 1]!
  }
  function decrease() {
    if (canDecrease.value) settings.value.scale = SCALES[scaleIndex.value - 1]!
  }
  function setContrast(contrast: ExamContrast) {
    settings.value.contrast = contrast
  }
  function reset() {
    settings.value = { scale: 1, contrast: 'default' }
  }

  function applyFontScale(scale: number) {
    document.documentElement.style.fontSize = scale === 1 ? '' : `${BASE_FONT_PX * scale}px`
  }

  // Side effects run once per component that calls this — they're idempotent
  // (same value written), so a page + modal pair stays consistent.
  onMounted(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as Partial<ExamSettings>
        if (saved.scale && SCALES.includes(saved.scale)) settings.value.scale = saved.scale
        if (saved.contrast) settings.value.contrast = saved.contrast
      }
    } catch { /* corrupt or unavailable storage — fall back to defaults */ }
    applyFontScale(settings.value.scale)
  })

  watch(settings, (v) => {
    applyFontScale(v.scale)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
    } catch { /* private mode — settings just won't persist */ }
  }, { deep: true })

  // The runner owns the root font size only while it's mounted.
  onUnmounted(() => applyFontScale(1))

  return {
    settings,
    scalePercent,
    canIncrease,
    canDecrease,
    increase,
    decrease,
    setContrast,
    reset
  }
}
