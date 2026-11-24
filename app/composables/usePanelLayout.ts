import type { InjectionKey } from 'vue'

export type PanelKind = 'admin' | 'teacher' | 'course'

/** Set by layouts/admin.vue and layouts/teacher.vue so AppPage renders cleanly inside the split panel shell. */
export const PANEL_LAYOUT: InjectionKey<PanelKind> = Symbol('panel-layout')

export const usePanelLayout = () => inject(PANEL_LAYOUT, null)
