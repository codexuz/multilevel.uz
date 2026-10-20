/**
 * Nuxt UI dressed in the manner of HeroUI v3, kept restrained: white surfaces on soft shadows over
 * a grey canvas, hairline-ringed fields, segmented tabs, and modest corners on the standard scale
 * (--ui-radius 0.25rem): 8px controls, 12px cards and overlays, 6px badges. On a phone, modals open
 * as sheets from the bottom. The tokens live in assets/css/main.css.
 */
const surface = 'bg-default shadow-surface ring-0'
const overlay = 'bg-default shadow-overlay ring-0 dark:ring-1 dark:ring-default'
// Fields keep a hairline ring: on the white paper of an exam a shadow alone is too faint to find.
const field = 'text-highlighted bg-(--ui-field) shadow-field ring ring-inset ring-default'

export default defineAppConfig({
  ui: {
    colors: {
      primary: 'brand',
      neutral: 'zinc'
    },

    button: {
      slots: {
        base: 'rounded-lg font-medium transition-[color,background-color,transform,box-shadow] duration-150 active:not-disabled:scale-[0.98] touch-manipulation'
      },
      compoundVariants: [
        { color: 'neutral', variant: 'outline', class: 'ring-0 bg-default shadow-surface hover:bg-elevated dark:ring-1 dark:ring-default' }
      ]
    },
    badge: {
      variants: {
        size: {
          xs: { base: 'rounded-sm' }, sm: { base: 'rounded-sm' }, md: { base: 'rounded-md' }, lg: { base: 'rounded-md' }, xl: { base: 'rounded-md' }
        }
      }
    },
    card: {
      slots: {
        root: 'rounded-xl',
        header: 'px-4 py-3.5 sm:px-5',
        body: 'p-4 sm:p-5',
        footer: 'px-4 py-3 sm:px-5'
      },
      variants: {
        variant: {
          outline: { root: `${surface} divide-y divide-default` },
          subtle: { root: `${surface} divide-y divide-default` },
          soft: { root: 'bg-elevated/60 divide-y divide-default' }
        }
      }
    },
    alert: {
      slots: { root: 'rounded-xl' },
      compoundVariants: [
        { variant: 'subtle', class: { root: 'ring-0 shadow-surface' } },
        { variant: 'outline', class: { root: 'ring-0 bg-default shadow-surface' } }
      ]
    },
    input: {
      slots: { base: 'rounded-lg' },
      variants: { variant: { outline: field } }
    },
    textarea: {
      slots: { base: 'rounded-lg' },
      variants: { variant: { outline: field } }
    },
    inputNumber: {
      slots: { base: 'rounded-lg' },
      variants: { variant: { outline: field } }
    },
    select: {
      slots: { base: 'rounded-lg', content: `rounded-xl p-1 ${overlay}`, item: 'rounded-md' },
      variants: { variant: { outline: field } }
    },
    selectMenu: {
      slots: { base: 'rounded-lg', content: `rounded-xl ${overlay}`, item: 'rounded-md' },
      variants: { variant: { outline: field } }
    },
    tabs: {
      slots: { trigger: 'rounded-md' },
      variants: {
        variant: {
          pill: { list: 'bg-elevated rounded-lg', indicator: 'rounded-md shadow-surface' }
        }
      },
      compoundVariants: [
        { color: 'primary', variant: 'pill', class: { indicator: 'bg-(--ui-segment)', trigger: 'data-[state=active]:text-highlighted' } },
        { color: 'neutral', variant: 'pill', class: { indicator: 'bg-(--ui-segment)', trigger: 'data-[state=active]:text-highlighted' } }
      ]
    },
    navigationMenu: {
      slots: { link: 'before:rounded-lg py-2' },
      compoundVariants: [
        { variant: 'pill', active: true, highlight: false, class: { link: 'before:bg-default before:shadow-surface dark:before:bg-elevated' } }
      ]
    },
    dropdownMenu: { slots: { content: `rounded-xl p-1 ${overlay}`, item: 'before:rounded-md' } },
    popover: { slots: { content: `rounded-xl ${overlay}` } },
    tooltip: { slots: { content: 'rounded-md ring-0 shadow-overlay' } },
    toast: { slots: { root: 'rounded-xl ring-0 shadow-overlay' } },
    modal: {
      slots: { content: 'divide-y-0', header: 'border-0 pb-0', footer: 'border-0 pt-0' },
      variants: {
        fullscreen: {
          false: {
            content: [
              'rounded-xl shadow-overlay ring-0 dark:ring-1 dark:ring-default',
              // A sheet from the bottom on a phone.
              'max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:pb-[env(safe-area-inset-bottom)]'
            ]
          }
        }
      }
    },
    slideover: { slots: { content: 'ring-0 shadow-overlay' } },
    table: {
      slots: { th: 'text-muted font-medium text-xs uppercase tracking-wide' }
    },

    dashboardPanel: {
      slots: {
        root: 'bg-canvas lg:not-last:border-e-0',
        body: 'p-4 sm:p-6 pb-24 lg:pb-8'
      }
    },
    dashboardNavbar: {
      slots: { root: 'border-b border-default bg-canvas/85 backdrop-blur-xl sticky top-0 z-10', title: 'text-base font-semibold tracking-tight' }
    },
    dashboardToolbar: {
      slots: { root: 'border-b border-default bg-canvas px-4 sm:px-6 py-1 [scrollbar-width:none]' }
    },
    dashboardSidebar: {
      slots: {
        root: 'bg-canvas border-e border-default',
        footer: 'border-t border-default',
        content: 'bg-canvas'
      }
    }
  }
})
