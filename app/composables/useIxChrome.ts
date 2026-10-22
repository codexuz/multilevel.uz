import type { InjectionKey, Ref } from 'vue'

/** A note a candidate wrote on words of the text, listed in the Notes panel. */
export interface IxNote {
  id: string
  /** The part it was written in, e.g. "Part 3". */
  part: string
  /** The words it is about. */
  quote: string
  comment: string
  /** Takes the note (and its marking) off the text. */
  remove: () => void
}

/**
 * What the screens of one test share, beside the theme: the Notes panel and its notes, the Options
 * page, and whether the candidate is on the submission page. The section (Listening, Reading or
 * Writing) owns its answers; the header and the panels around it use this.
 */
export interface IxChrome {
  notesOpen: Ref<boolean>
  optionsOpen: Ref<boolean>
  submissionOpen: Ref<boolean>
  /** The part on screen, which a new note is filed under. */
  partLabel: Ref<string>
  notes: Ref<IxNote[]>
  addNote: (note: IxNote) => void
  setComment: (id: string, comment: string) => void
  /** A note to bring into view and focus in the panel, when it is opened from the text. */
  focusNote: Ref<string | null>
  /** Where Leave test goes. */
  leaveTo: Ref<string | undefined>
}

const KEY: InjectionKey<IxChrome> = Symbol('ix-chrome')

export function provideIxChrome(): IxChrome {
  const notes = ref<IxNote[]>([])
  const chrome: IxChrome = {
    notesOpen: ref(false),
    optionsOpen: ref(false),
    submissionOpen: ref(false),
    partLabel: ref(''),
    notes,
    addNote: note => (notes.value = [...notes.value, note]),
    setComment: (id, comment) => {
      notes.value = notes.value.map(n => (n.id === id ? { ...n, comment } : n))
    },
    focusNote: ref(null),
    leaveTo: ref(undefined)
  }
  provide(KEY, chrome)
  return chrome
}

export function useIxChrome() {
  return inject(KEY, null)
}
