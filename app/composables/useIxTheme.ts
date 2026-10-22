import type { InjectionKey, Ref } from 'vue'

export type IxContrast = 'black-on-white' | 'white-on-black' | 'yellow-on-black'
export type IxTextSize = 'standard' | 'large' | 'extra-large'

/**
 * The colours of the computer-delivered IELTS screen (Inspera), measured from the official demo,
 * and the two high-contrast schemes it offers. Every exam style reads them as --ix-* variables.
 */
interface Palette {
  bg: string
  text: string
  muted: string
  line: string
  rubricBg: string
  rubricBorder: string
  accent: string
  optionHover: string
  optionSelected: string
  answered: string
  track: string
  prevBtn: string
  nextBtn: string
  arrowIcon: string
  disabledBtn: string
  deliver: string
  deliverIcon: string
  panel: string
  inputBorder: string
  highlightBg: string
  highlightText: string
  /** Words a note is written on, and the note in hand in the Notes panel. */
  noteBg: string
  brand: string
}

const PALETTES: Record<IxContrast, Palette> = {
  'black-on-white': {
    bg: '#ffffff', text: '#000000', muted: '#535353', line: '#c1c1c1', rubricBg: '#f1f2ec', rubricBorder: '#d5d5d5',
    accent: '#418fc6', optionHover: '#e4e4e4', optionSelected: '#bbd8f0', answered: '#358e14', track: '#d7d7d7',
    prevBtn: '#4c4c4c', nextBtn: '#000000', arrowIcon: '#ffffff', disabledBtn: '#dddddd', deliver: '#efefef', deliverIcon: '#535353',
    panel: '#e8e8e8', inputBorder: '#535353', highlightBg: '#7d4a5a', highlightText: '#ffffff', noteBg: '#1e46be', brand: '#e31837'
  },
  'white-on-black': {
    bg: '#000000', text: '#ffffff', muted: '#cccccc', line: '#666666', rubricBg: '#1a1a1a', rubricBorder: '#666666',
    accent: '#6fb4e6', optionHover: '#333333', optionSelected: '#23486a', answered: '#5cbf3a', track: '#555555',
    prevBtn: '#555555', nextBtn: '#ffffff', arrowIcon: '#000000', disabledBtn: '#333333', deliver: '#222222', deliverIcon: '#ffffff',
    panel: '#222222', inputBorder: '#cccccc', highlightBg: '#e6c84f', highlightText: '#000000', noteBg: '#1e46be', brand: '#ffffff'
  },
  'yellow-on-black': {
    bg: '#000000', text: '#ffff00', muted: '#e6e600', line: '#808000', rubricBg: '#1a1a00', rubricBorder: '#808000',
    accent: '#ffff00', optionHover: '#333300', optionSelected: '#4d4d00', answered: '#7fff00', track: '#555500',
    prevBtn: '#555500', nextBtn: '#ffff00', arrowIcon: '#000000', disabledBtn: '#333300', deliver: '#222200', deliverIcon: '#ffff00',
    panel: '#1a1a00', inputBorder: '#ffff00', highlightBg: '#ffff00', highlightText: '#000000', noteBg: '#1e46be', brand: '#ffff00'
  }
}

/** Standard, Large and Extra large, as the test offers them. */
const FONT_PX: Record<IxTextSize, number> = { 'standard': 16, 'large': 19, 'extra-large': 22 }

export interface IxTheme {
  contrast: Ref<IxContrast>
  textSize: Ref<IxTextSize>
  style: Ref<Record<string, string>>
  isDark: Ref<boolean>
}

const KEY: InjectionKey<IxTheme> = Symbol('ix-theme')

const kebab = (key: string) => key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)

export function provideIxTheme() {
  const contrast = ref<IxContrast>('black-on-white')
  const textSize = ref<IxTextSize>('standard')
  const isDark = computed(() => contrast.value !== 'black-on-white')
  const style = computed(() => {
    const p = PALETTES[contrast.value]
    const vars: Record<string, string> = Object.fromEntries(Object.entries(p).map(([k, v]) => [`--ix-${kebab(k)}`, v]))
    return {
      ...vars,
      // Nuxt UI pieces inside the test (dialogs) follow the same scheme.
      '--ui-bg': p.bg,
      '--ui-bg-muted': p.rubricBg,
      '--ui-bg-elevated': p.rubricBg,
      '--ui-bg-accented': p.line,
      '--ui-bg-inverted': p.text,
      '--ui-text': p.text,
      '--ui-text-highlighted': p.text,
      '--ui-text-toned': p.text,
      '--ui-text-muted': p.muted,
      '--ui-text-dimmed': p.muted,
      '--ui-text-inverted': p.bg,
      '--ui-border': p.line,
      '--ui-border-muted': p.line,
      '--ui-border-accented': p.muted,
      '--ix-font-size': `${FONT_PX[textSize.value]}px`
    }
  })
  const theme: IxTheme = { contrast, textSize, style, isDark }
  provide(KEY, theme)
  return theme
}

export function useIxTheme() {
  return inject(KEY, null)
}
