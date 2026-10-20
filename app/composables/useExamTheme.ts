import type { InjectionKey, Ref } from 'vue'

export type ContrastMode = 'black-on-white' | 'white-on-black' | 'yellow-on-black'
export type TextSizeMode = 'small' | 'medium' | 'large'

interface Palette {
  bg: string
  panel: string
  elevated: string
  text: string
  muted: string
  border: string
  accent: string
  inverted: string
}

const PALETTES: Record<ContrastMode, Palette> = {
  'black-on-white': { bg: '#f9fafb', panel: '#ffffff', elevated: '#f1f5f9', text: '#1a202c', muted: '#718096', border: '#e2e8f0', accent: '#636eee', inverted: '#ffffff' },
  'white-on-black': { bg: '#111111', panel: '#1a1a2e', elevated: '#2d3748', text: '#e2e8f0', muted: '#a0aec0', border: '#2d3748', accent: '#63b3ed', inverted: '#111111' },
  'yellow-on-black': { bg: '#111111', panel: '#1a1a1a', elevated: '#2a2a2a', text: '#f6c543', muted: '#d4a843', border: '#333333', accent: '#f6c543', inverted: '#111111' }
}

const FONT_SCALE: Record<TextSizeMode, number> = { small: 0.85, medium: 1, large: 1.2 }

export interface ExamTheme {
  contrast: Ref<ContrastMode>
  textSize: Ref<TextSizeMode>
  style: Ref<Record<string, string>>
  isDark: Ref<boolean>
}

const KEY: InjectionKey<ExamTheme> = Symbol('exam-theme')

export function provideExamTheme() {
  const contrast = ref<ContrastMode>('black-on-white')
  const textSize = ref<TextSizeMode>('medium')
  const isDark = computed(() => contrast.value !== 'black-on-white')
  const style = computed(() => {
    const p = PALETTES[contrast.value]
    return {
      '--ui-bg': p.panel,
      '--ui-bg-muted': p.bg,
      '--ui-bg-elevated': p.elevated,
      '--ui-bg-accented': p.border,
      '--ui-bg-inverted': p.text,
      '--ui-text': p.text,
      '--ui-text-highlighted': p.text,
      '--ui-text-toned': p.text,
      '--ui-text-muted': p.muted,
      '--ui-text-dimmed': p.muted,
      '--ui-text-inverted': p.inverted,
      '--ui-border': p.border,
      '--ui-border-muted': p.border,
      '--ui-border-accented': p.muted,
      '--ui-primary': p.accent,
      // The paper keeps its own colours whatever the site's mode: fields and their shadow follow it.
      '--ui-field': isDark.value ? p.elevated : p.panel,
      '--ui-segment': isDark.value ? p.border : p.panel,
      '--field-shadow': 'none',
      'fontSize': `${FONT_SCALE[textSize.value]}rem`
    }
  })
  const theme: ExamTheme = { contrast, textSize, style, isDark }
  provide(KEY, theme)
  return theme
}

export function useExamTheme() {
  return inject(KEY, null)
}
