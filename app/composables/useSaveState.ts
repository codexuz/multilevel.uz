import type { InjectionKey, Ref } from 'vue'

/**
 * What the exam header shows about the answers (components/exam/Header.vue, from the erp-lms IELTS
 * app). Here they are kept in this browser as they are given, and sent once, on handing in.
 */
export type SaveState = 'saved' | 'pending' | 'saving' | 'offline'
export const SAVE_STATE: InjectionKey<Ref<SaveState>> = Symbol('exam-save-state')
