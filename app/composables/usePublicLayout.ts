import type { InjectionKey } from 'vue'

/** Set by layouts/public.vue: pages inside it are laid out as a website, not in the app's panels. */
export const PUBLIC_LAYOUT: InjectionKey<true> = Symbol('public-layout')

export const useInPublicLayout = () => inject(PUBLIC_LAYOUT, false)
